import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import OpenjutsuPanel from './OpenjutsuPanel.vue'

const models = { target: '', size: '768p' as const, videoUrl: 'blob:clip' }

describe('OpenjutsuPanel', () => {
  it('shows the chosen video with the part to swap, and the way to trim or change it', async () => {
    const { emitted } = render(OpenjutsuPanel, {
      props: {
        ...models,
        videoName: 'dance.mp4',
        clipSeconds: 20,
        range: { start: 2, seconds: 6 },
        partSeconds: 6
      }
    })
    const other = new File(['other'], 'other.mp4', { type: 'video/mp4' })

    expect(screen.getByText('dance.mp4')).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Trim: Swapping 2.0 – 8.0 s (6.0 s of 20.0 s)'
      })
    )
    await userEvent.upload(screen.getByLabelText('Choose another clip'), other)

    expect(emitted('trim')).toHaveLength(1)
    expect(emitted('video')).toEqual([[other]])
  })

  it('takes a character image from an upload tile', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })
    const face = new File(['face'], 'face.png', { type: 'image/png' })

    expect(
      screen.getByRole('button', { name: 'Add a character image' })
    ).toBeVisible()
    await userEvent.upload(screen.getByTestId('openjutsu-character-file'), face)

    expect(emitted('character')).toEqual([[face]])
  })

  it('shows the chosen character as a tile beside a tile to change it', async () => {
    const { emitted } = render(OpenjutsuPanel, {
      props: { ...models, characterUrl: 'blob:face', characterName: 'face.png' }
    })
    const other = new File(['other'], 'other.png', { type: 'image/png' })

    expect(screen.getByRole('radio', { name: 'face.png' })).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Choose another character image' })
    ).toBeVisible()
    await userEvent.upload(
      screen.getByTestId('openjutsu-character-file'),
      other
    )

    expect(emitted('character')).toEqual([[other]])
  })

  it('edits who to replace, the quality and a fixed seed', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })

    await userEvent.type(screen.getByLabelText('Who to replace'), 'the man')
    await userEvent.selectOptions(screen.getByLabelText('Quality'), '480p')
    await userEvent.type(screen.getByLabelText('Seed'), '42{Tab}')

    expect(emitted('update:target').at(-1)).toEqual(['the man'])
    expect(emitted('update:size')).toEqual([['480p']])
    expect(emitted('update:seed')).toEqual([[42]])
  })

  it('goes back to a new seed every take when the seed is cleared', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })
    const field = screen.getByLabelText('Seed')

    await userEvent.type(field, '7{Tab}')
    await userEvent.clear(field)
    await userEvent.tab()

    expect(emitted('update:seed')).toEqual([[7], [undefined]])
  })

  it('fixes a random seed from the dice', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })

    await userEvent.click(
      screen.getByRole('button', { name: 'Pick a random seed' })
    )

    expect(emitted('update:seed')).toEqual([[expect.any(Number)]])
  })
})
