import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorSourceTile from './EditorSourceTile.vue'

const labels = { addLabel: 'Add the video to edit', changeLabel: 'Change' }

describe('EditorSourceTile', () => {
  it('asks for the source while empty and hands back a picked file', async () => {
    const { emitted } = render(EditorSourceTile, {
      props: { kind: 'video', inputTestId: 'source', ...labels }
    })
    const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })

    expect(
      screen.getByRole('button', { name: 'Add the video to edit' })
    ).toBeVisible()
    await userEvent.upload(screen.getByTestId('source'), clip)

    expect(emitted('file')).toEqual([[clip]])
  })

  it('shows the chosen source and offers to change it, with its overlay', () => {
    render(EditorSourceTile, {
      props: { kind: 'image', src: 'blob:photo', name: 'photo.jpg', ...labels },
      slots: { default: '<span>0.0–8.0 s</span>' }
    })

    expect(
      screen.getByRole('button', { name: 'Change: photo.jpg' })
    ).toBeVisible()
    expect(screen.getByText('0.0–8.0 s')).toBeVisible()
  })

  it('ignores a dropped file of the other kind', async () => {
    const { emitted } = render(EditorSourceTile, {
      props: { kind: 'image', inputTestId: 'source', ...labels }
    })
    const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })

    await userEvent.upload(screen.getByTestId('source'), clip, {
      applyAccept: false
    })

    expect(emitted('file')).toBeUndefined()
  })
})
