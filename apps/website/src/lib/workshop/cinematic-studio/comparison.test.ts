import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import CinematicCompare from '../../../components/workshop/cinematic-studio/CinematicCompare.vue'
import { AUTO_DIRECTION } from './catalog'
import type { SavedCreation } from './creations'
import {
  comparisonCanShow,
  comparisonPair,
  comparisonSettings,
  comparisonSource
} from './comparison'

function creation(
  id: string,
  changes: Partial<SavedCreation> = {}
): SavedCreation {
  return {
    id,
    takeId: `take-${id}`,
    name: `Creation ${id}`,
    modelSlug: 'test-model',
    prompt: `Prompt ${id}`,
    aspect: '16:9',
    createdAt: 1,
    kind: 'image',
    fileName: `${id}.png`,
    nsfw: false,
    favorite: false,
    blob: new Blob(['frame'], { type: 'image/png' }),
    ...changes
  }
}

describe('creation comparison helpers', () => {
  it('selects distinct available creations and recovers from removed selections', () => {
    const items = [creation('a'), creation('b'), creation('c')]
    expect(comparisonPair(items).map((item) => item?.id)).toEqual(['a', 'b'])
    expect(comparisonPair(items, 'b', 'b').map((item) => item?.id)).toEqual([
      'b',
      'a'
    ])
    expect(
      comparisonPair(items, 'removed', 'c').map((item) => item?.id)
    ).toEqual(['a', 'c'])
    expect(comparisonPair([])).toEqual([undefined, undefined])
  })

  it('resolves saved source IDs and original take IDs without self-lineage', () => {
    const original = creation('original')
    const edited = creation('edit', {
      settings: {
        scene: 'Scene',
        mode: 'image',
        enhance: false,
        direction: AUTO_DIRECTION,
        sourceId: original.takeId,
        operation: 'camera'
      }
    })
    expect(comparisonSource(edited, [original, edited])).toEqual(original)
    expect(comparisonSource(edited, [edited])).toBeUndefined()
    expect(
      comparisonSource(
        {
          ...edited,
          settings: {
            ...edited.settings,
            scene: 'Scene',
            mode: 'image',
            enhance: false,
            direction: AUTO_DIRECTION,
            sourceId: edited.id
          }
        },
        [edited]
      )
    ).toBeUndefined()
  })

  it('keeps saved seed zero and explicit audio-off while preferring video settings', () => {
    const item = creation('video', {
      kind: 'video',
      settings: {
        scene: 'Scene',
        mode: 'video',
        enhance: false,
        direction: AUTO_DIRECTION,
        seed: 0,
        resolution: '2K',
        video: { resolution: '720P', durationSeconds: 8, generateAudio: false }
      }
    })
    expect(comparisonSettings(item)).toMatchObject({
      seed: 0,
      resolution: '720P',
      duration: 8,
      audio: false
    })
  })

  it.for(['image', 'video'] as const)(
    'requires reveal before loading flagged %s',
    (kind) => {
      const item = creation(kind, { kind, nsfw: true })
      expect(comparisonCanShow(item, [], `blob:${kind}`)).toBe(false)
      expect(comparisonCanShow(item, [item.id], `blob:${kind}`)).toBe(true)
      expect(comparisonCanShow(item, [item.id], undefined)).toBe(false)
    }
  )
})

describe('CinematicCompare', () => {
  it('does not mount flagged media before reveal and resets reveal on selection change', async () => {
    const user = userEvent.setup()
    const items = [
      creation('image', { nsfw: true }),
      creation('video', { nsfw: true, kind: 'video' }),
      creation('other')
    ]
    render(CinematicCompare, {
      props: {
        open: true,
        items,
        urls: { image: 'blob:image', video: 'blob:video', other: 'blob:other' }
      }
    })
    await screen.findByRole('dialog', { name: 'Compare creations' })
    const left = screen.getByRole('region', { name: 'First creation' })
    const right = screen.getByRole('region', { name: 'Second creation' })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Video preview: Creation video')
    ).not.toBeInTheDocument()
    await user.click(
      within(left).getByRole('button', { name: 'Reveal creation' })
    )
    expect(screen.getByRole('img', { name: 'Creation image' })).toHaveAttribute(
      'src',
      'blob:image'
    )
    await user.click(
      within(right).getByRole('button', { name: 'Reveal creation' })
    )
    expect(
      screen.getByLabelText('Video preview: Creation video')
    ).toHaveAttribute('controls')
    expect(
      screen.getByLabelText('Video preview: Creation video')
    ).not.toHaveAttribute('autoplay')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'First creation' }),
      'other'
    )
    expect(
      screen.queryByLabelText('Video preview: Creation video')
    ).not.toBeInTheDocument()
  })

  it('shows human model names and source lineage and closes without changing creations', async () => {
    const user = userEvent.setup()
    const original = creation('original')
    const edited = creation('edited', {
      settings: {
        scene: 'Scene',
        mode: 'image',
        enhance: false,
        direction: AUTO_DIRECTION,
        sourceId: original.id,
        operation: 'relight'
      }
    })
    const { emitted } = render(CinematicCompare, {
      props: {
        open: true,
        items: [original, edited],
        urls: { original: 'blob:original', edited: 'blob:edited' },
        models: [{ slug: 'test-model', name: 'My image model' }]
      }
    })
    await screen.findByRole('dialog', { name: 'Compare creations' })
    expect(
      within(screen.getByRole('region', { name: 'First creation' })).getByText(
        'My image model'
      )
    ).toBeInTheDocument()
    const right = screen.getByRole('region', { name: 'Second creation' })
    expect(within(right).getByText('Creation original')).toBeInTheDocument()
    expect(within(right).getByText('Relight')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(emitted('update:open')).toEqual([[false]])
    expect(original.name).toBe('Creation original')
  })
})

describe('comparison actions', () => {
  it('reuses the chosen result and closes comparison', async () => {
    const user = userEvent.setup()
    const items = [creation('a'), creation('b')]
    const { emitted } = render(CinematicCompare, {
      props: { open: true, items, urls: {} }
    })
    const right = await screen.findByRole('region', { name: 'Second creation' })
    await user.click(
      within(right).getByRole('button', { name: 'Reuse settings' })
    )
    expect(emitted('reuse')).toEqual([[items[1]]])
    expect(emitted('update:open')).toEqual([[false]])
  })

  it('requires revealing flagged images before animating and never offers video animation', async () => {
    const user = userEvent.setup()
    const { emitted } = render(CinematicCompare, {
      props: {
        open: true,
        items: [
          creation('a', { nsfw: true }),
          creation('b', { kind: 'video' })
        ],
        urls: { a: 'blob:a', b: 'blob:b' }
      }
    })
    const left = await screen.findByRole('region', { name: 'First creation' })
    const animate = within(left).getByRole('button', { name: 'Animate' })
    expect(animate).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Animate' })).toHaveLength(1)
    await user.click(
      within(left).getByRole('button', { name: 'Reveal creation' })
    )
    await user.click(animate)
    expect(emitted('animate')).toEqual([['blob:a', 'a.png']])
    expect(emitted('update:open')).toEqual([[false]])
  })

  it('blocks editing-setting reuse, unavailable animation and actions during generation', async () => {
    const user = userEvent.setup()
    const items = [
      creation('a', {
        settings: {
          scene: 'Edit',
          mode: 'image',
          enhance: false,
          direction: AUTO_DIRECTION,
          operation: 'camera'
        }
      }),
      creation('b')
    ]
    const { emitted, rerender } = render(CinematicCompare, {
      props: { open: true, items, urls: {} }
    })
    const left = await screen.findByRole('region', { name: 'First creation' })
    expect(
      within(left).getByRole('button', { name: 'Reuse settings' })
    ).toBeDisabled()
    expect(within(left).getByText(/Edited results cannot reuse/)).toBeVisible()
    expect(within(left).getByRole('button', { name: 'Animate' })).toBeDisabled()
    await rerender({ busy: true, urls: { a: 'blob:a', b: 'blob:b' } })
    for (const button of screen.getAllByRole('button', {
      name: /^(Reuse settings|Animate)$/
    })) {
      expect(button).toBeDisabled()
      await user.click(button)
    }
    expect(emitted('reuse')).toBeUndefined()
    expect(emitted('animate')).toBeUndefined()
  })
})

it('restores a selected pair after the library loads and keeps selections separate by workspace', async () => {
  const user = userEvent.setup()
  const items = [creation('a'), creation('b'), creation('c')]
  const namespace = 'comparison-ui-workspace'
  localStorage.removeItem(`cinematic-comparison-selection-v1:${namespace}`)
  const initial = render(CinematicCompare, {
    props: { open: true, namespace, items, urls: {} }
  })
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'First creation' }),
    'c'
  )
  initial.unmount()
  const restored = render(CinematicCompare, {
    props: { open: true, namespace, items: [], urls: {} }
  })
  await screen.findByText('Save at least two creations to compare them here.')
  await restored.rerender({ items })
  expect(
    await screen.findByRole('combobox', { name: 'First creation' })
  ).toHaveValue('c')
  expect(screen.getByRole('combobox', { name: 'Second creation' })).toHaveValue(
    'b'
  )
  await restored.rerender({ namespace: 'comparison-other-workspace' })
  expect(screen.getByRole('combobox', { name: 'First creation' })).toHaveValue(
    'a'
  )
  await restored.rerender({ items: [items[1], items[2]] })
  expect(screen.getByRole('combobox', { name: 'First creation' })).toHaveValue(
    'b'
  )
  expect(screen.getByRole('combobox', { name: 'Second creation' })).toHaveValue(
    'c'
  )
})

it('highlights recorded zero and audio-off against missing settings and gates original links behind reveal', async () => {
  const user = userEvent.setup()
  const a = creation('a', {
    nsfw: true,
    settings: {
      scene: 'A',
      mode: 'image',
      enhance: false,
      direction: AUTO_DIRECTION,
      seed: 0,
      video: { durationSeconds: 5, resolution: '720p', generateAudio: false }
    }
  })
  render(CinematicCompare, {
    props: { open: true, items: [a, creation('b')], urls: { a: 'blob:a' } }
  })
  const table = await screen.findByRole('table', {
    name: 'Compare saved settings'
  })
  const seed = within(table).getByRole('row', {
    name: 'Seed Different 0 Not recorded'
  })
  expect(seed).toBeVisible()
  expect(
    within(table).getByRole('row', {
      name: 'Audio Different Off Not recorded'
    })
  ).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Open original (new tab)' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reveal creation' }))
  const link = screen.getByRole('link', { name: 'Open original (new tab)' })
  expect(link).toHaveAttribute('href', 'blob:a')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'download',
    'a.png'
  )
})
