import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorSourceTile from './EditorSourceTile.vue'

const labels = {
  addLabel: 'Add the video to edit',
  removeLabel: 'Remove video'
}

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

  it('names the chosen source over its cover and takes it out with the X', async () => {
    const { emitted } = render(EditorSourceTile, {
      props: {
        kind: 'image',
        src: 'blob:photo',
        caption: 'photo.jpg',
        ...labels
      },
      slots: { default: '<span>Using 0.0–8.0 s</span>' }
    })

    expect(screen.getByText('photo.jpg')).toBeVisible()
    expect(screen.getByText('Using 0.0–8.0 s')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Remove video' }))

    expect(emitted('remove')).toHaveLength(1)
  })

  it('ignores a picked file of the other kind', async () => {
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
