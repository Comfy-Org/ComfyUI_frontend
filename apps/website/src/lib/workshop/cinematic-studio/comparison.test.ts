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
    expect(screen.getAllByText('My image model')).toHaveLength(2)
    const right = screen.getByRole('region', { name: 'Second creation' })
    expect(within(right).getByText('Creation original')).toBeInTheDocument()
    expect(within(right).getByText('Relight')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(emitted('update:open')).toEqual([[false]])
    expect(original.name).toBe('Creation original')
  })
})
