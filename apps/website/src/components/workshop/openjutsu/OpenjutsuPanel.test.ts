import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import OpenjutsuPanel from './OpenjutsuPanel.vue'

const models = { target: '', size: '768p' as const, videoUrl: 'blob:clip' }

describe('OpenjutsuPanel', () => {
  it('shows the part being swapped and opens the trim from it', async () => {
    const { emitted } = render(OpenjutsuPanel, {
      props: {
        ...models,
        videoName: 'dance.mp4',
        clipSeconds: 20,
        range: { start: 2, seconds: 6 },
        partSeconds: 6
      }
    })

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Trim: 2.0–8.0 s of 20.0 s'
      })
    )

    expect(emitted('trim')).toHaveLength(1)
    expect(
      screen.getByText('Swapping 2.0 – 8.0 s (6.0 s of 20.0 s)')
    ).toBeVisible()
  })

  it.for([
    {
      slot: 'video',
      action: 'Change: dance.mp4',
      input: 'openjutsu-video-file',
      file: new File(['clip'], 'other.mp4', { type: 'video/mp4' })
    },
    {
      slot: 'character',
      action: 'Add a character image',
      input: 'openjutsu-character-file',
      file: new File(['face'], 'face.png', { type: 'image/png' })
    }
  ] as const)(
    'takes a new $slot from its upload',
    async ({ slot, action, input, file }) => {
      const { emitted } = render(OpenjutsuPanel, {
        props: { ...models, videoName: 'dance.mp4' }
      })

      expect(screen.getByRole('button', { name: action })).toBeVisible()
      await userEvent.upload(screen.getByTestId(input), file)

      expect(emitted(slot)).toEqual([[file]])
    }
  )

  it('says who to describe, and the size the result is saved at', async () => {
    const { rerender } = render(OpenjutsuPanel, { props: models })

    expect(screen.getByLabelText('Who to replace')).toHaveAccessibleDescription(
      'Describe one person so they cannot be confused with anyone else in the shot.'
    )
    expect(
      screen.getByText("The result always keeps your video's shape.")
    ).toBeVisible()

    await rerender({ savedSize: { width: 1344, height: 756 } })

    expect(
      screen.getByText('Saves at 1344×756, the same shape as your video.')
    ).toBeVisible()
  })

  it('keeps the chosen inputs without a way to empty them', () => {
    render(OpenjutsuPanel, {
      props: { ...models, characterUrl: 'blob:face', characterName: 'face.png' }
    })

    expect(
      screen.getByRole('button', {
        name: 'Change: face.png'
      })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('edits who to replace, the quality and a fixed seed', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: models })

    await userEvent.type(screen.getByLabelText('Who to replace'), 'the man')
    await userEvent.click(
      screen.getByRole('button', { name: 'Quality: 768p · sharper' })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /480p/ })
    )
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
