import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import OpenjutsuPanel from './OpenjutsuPanel.vue'

const models = { target: '', size: '768p' as const }

describe('OpenjutsuPanel', () => {
  it('asks for a video and a character before either is chosen', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })
    const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
    const face = new File(['face'], 'face.png', { type: 'image/png' })

    await userEvent.upload(screen.getByLabelText('Add the video to edit'), clip)
    await userEvent.upload(screen.getByTestId('openjutsu-character-file'), face)

    expect(emitted('video')).toEqual([[clip]])
    expect(emitted('character')).toEqual([[face]])
  })

  it('shows the chosen video with the part to swap, and the way to trim or change it', async () => {
    const { emitted } = render(OpenjutsuPanel, {
      props: {
        ...models,
        videoUrl: 'blob:clip',
        videoName: 'dance.mp4',
        clipSeconds: 20,
        range: { start: 2, seconds: 6 },
        partSeconds: 6
      }
    })
    const other = new File(['other'], 'other.mp4', { type: 'video/mp4' })

    expect(screen.getByText('dance.mp4')).toBeVisible()
    expect(
      screen.getByText('Swapping 2.0 – 8.0 s (6.0 s of 20.0 s)')
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Trim' }))
    await userEvent.upload(screen.getByLabelText('Choose another clip'), other)

    expect(emitted('trim')).toHaveLength(1)
    expect(emitted('video')).toEqual([[other]])
  })

  it('edits who to replace, the quality and a fixed seed', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })

    await userEvent.type(screen.getByLabelText('Who to replace'), 'the man')
    await userEvent.selectOptions(screen.getByLabelText('Quality'), '480p')
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    await userEvent.type(screen.getByLabelText('Seed'), '42{Tab}')

    expect(emitted('update:target').at(-1)).toEqual(['the man'])
    expect(emitted('update:size')).toEqual([['480p']])
    expect(emitted('update:seed')).toEqual([[42]])
  })
})
