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
