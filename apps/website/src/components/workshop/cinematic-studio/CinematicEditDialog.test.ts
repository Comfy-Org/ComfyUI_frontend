import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AUTO_DIRECTION } from '../../../lib/workshop/cinematic-studio/catalog'
import CinematicEditDialog from './CinematicEditDialog.vue'

function props() {
  return {
    source: {
      file: new File(['frame'], 'frame.png', { type: 'image/png' }),
      url: 'blob:source',
      name: 'Selected frame'
    },
    models: [
      {
        slug: 'byteplus--seedream-4-5--edit-images',
        name: 'Seedream 4.5',
        provider: 'BytePlus',
        logo: ''
      }
    ],
    direction: AUTO_DIRECTION
  }
}

describe('CinematicEditDialog', () => {
  it('reviews portrait guidance with only the selected character and keeps choices after returning', async () => {
    const initial = props()
    const portrait = new File(['portrait'], 'mara.png', { type: 'image/png' })
    const assets = [
      {
        id: 'mara',
        name: 'Mara',
        kind: 'character' as const,
        notes: 'Olive coat',
        file: portrait
      }
    ]
    const user = userEvent.setup()
    const view = render(CinematicEditDialog, {
      props: {
        ...initial,
        assets,
        models: [
          {
            ...initial.models[0],
            referenceMax: 3,
            imageAspects: ['1:1', '3:2', '2:3']
          }
        ]
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Camera view' }))
    expect(
      screen.getByRole('combobox', { name: 'Output aspect ratio' })
    ).toHaveValue('3:2')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'How to guide this shot' }),
      'portrait'
    )
    expect(screen.getByRole('button', { name: 'Review edit' })).toBeDisabled()
    await user.type(
      screen.getByRole('textbox', { name: 'Scene to rebuild' }),
      'Mara enters the lighthouse'
    )
    await user.click(screen.getByRole('button', { name: 'Review edit' }))
    expect(view.emitted('review')).toEqual([
      [
        expect.objectContaining({
          sourceFile: portrait,
          sourceFiles: [],
          cameraGuidance: expect.objectContaining({
            mode: 'portrait',
            assetIds: ['mara']
          }),
          prompt: expect.stringContaining('Image 1: character reference')
        })
      ]
    ])
    await view.rerender({ source: { ...initial.source } })
    expect(
      screen.getByRole('combobox', { name: 'How to guide this shot' })
    ).toHaveValue('portrait')
    expect(
      screen.getByRole('textbox', { name: 'Scene to rebuild' })
    ).toHaveValue('Mara enters the lighthouse')
  })
  it('keeps the imported edit recipe when returning from review', async () => {
    const initial = props()
    const source = {
      ...initial.source,
      recipe: {
        modelSlug: initial.models[0].slug,
        prompt: 'Preserve the person; soften the window light.',
        aspect: '4:3' as const,
        operation: 'relight' as const
      }
    }
    const { emitted } = render(CinematicEditDialog, {
      props: { ...initial, source }
    })
    const user = userEvent.setup()
    expect(
      await screen.findByRole('textbox', { name: 'Edit instruction' })
    ).toHaveValue(source.recipe.prompt)
    await user.click(screen.getByRole('button', { name: 'Review edit' }))
    expect(emitted('review')).toEqual([
      [{ ...source.recipe, takes: 1, sourceFile: source.file }]
    ])
  })
  it('reviews the selected source and exact instruction without closing the draft', async () => {
    const user = userEvent.setup()
    const initial = props()
    const { emitted, rerender } = render(CinematicEditDialog, {
      props: initial
    })
    expect(
      await screen.findByRole('button', { name: 'Review edit' })
    ).toBeDisabled()
    await user.type(
      screen.getByRole('textbox', { name: 'Edit instruction' }),
      'Make the coat blue'
    )
    await user.click(screen.getByRole('button', { name: 'Review edit' }))
    expect(emitted('review')).toEqual([
      [
        {
          modelSlug: initial.models[0].slug,
          takes: 1,
          prompt: 'Make the coat blue',
          aspect: '16:9',
          sourceFile: initial.source.file,
          operation: 'edit'
        }
      ]
    ])
    expect(emitted('close')).toBeUndefined()
    await rerender({ ...initial, source: { ...initial.source } })
    expect(
      screen.getByRole('textbox', { name: 'Edit instruction' })
    ).toHaveValue('Make the coat blue')
  })

  it('builds camera and relighting instructions before review', async () => {
    const user = userEvent.setup()
    render(CinematicEditDialog, { props: props() })
    await user.click(await screen.findByRole('button', { name: 'Camera view' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Viewpoint' }),
      'right'
    )
    expect(screen.getByDisplayValue(/right-side profile/)).toHaveAccessibleName(
      'Edit instruction'
    )
    await user.click(screen.getByRole('button', { name: 'Relight' }))
    expect(
      screen.getByText(/This is a prompt-based image edit/)
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue(/low-angle sunlight/)).toHaveAccessibleName(
      'Edit instruction'
    )
  })

  it('requires a treatment when current look is all auto', async () => {
    const user = userEvent.setup()
    render(CinematicEditDialog, { props: props() })
    await user.click(await screen.findByRole('button', { name: 'Change look' }))
    expect(screen.getByRole('button', { name: 'Review edit' })).toBeDisabled()
    expect(
      screen.getByText(/Describe a color, lighting or lens treatment below/)
    ).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'Edit instruction' }),
      'Keep the scene and apply a warm palette'
    )
    expect(screen.getByRole('button', { name: 'Review edit' })).toBeEnabled()
  })
})

it('reviews variations and zero seed, clears seed when switching to an unsupported model', async () => {
  const initial = props()
  const user = userEvent.setup()
  const { emitted } = render(CinematicEditDialog, {
    props: {
      ...initial,
      models: [
        { ...initial.models[0], seed: { minimum: 0, maximum: 100, step: 1 } },
        { ...initial.models[0], slug: 'unseeded', name: 'Unseeded model' }
      ]
    }
  })
  await user.click(await screen.findByRole('button', { name: 'Camera view' }))
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Variations' }),
    '3'
  )
  const seed = screen.getByRole('spinbutton', { name: 'Seed (optional)' })
  await user.type(seed, '101')
  expect(screen.getByRole('button', { name: 'Review edit' })).toBeDisabled()
  await user.clear(seed)
  await user.type(seed, '0')
  await user.click(screen.getByRole('button', { name: 'Review edit' }))
  expect(emitted('review')[0]).toEqual([
    expect.objectContaining({ takes: 3, seed: 0 })
  ])
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Image editing model' }),
    'unseeded'
  )
  expect(
    screen.queryByRole('spinbutton', { name: 'Seed (optional)' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Review edit' }))
  expect(emitted('review')[1]).toEqual([expect.objectContaining({ takes: 3 })])
  const secondReview = emitted('review')[1]
  expect(Array.isArray(secondReview)).toBe(true)
  if (Array.isArray(secondReview))
    expect(secondReview[0]).not.toHaveProperty('seed')
})
