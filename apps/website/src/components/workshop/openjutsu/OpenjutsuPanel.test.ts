import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import OpenjutsuPanel from './OpenjutsuPanel.vue'

const models = { target: '', size: '768p' as const }
const longClip = {
  ...models,
  videoUrl: 'blob:clip',
  videoName: 'dance.mp4',
  clipSeconds: 20,
  trimmed: true
}

describe('OpenjutsuPanel', () => {
  it.for([
    { range: { start: 0, seconds: 15 }, note: 'Using the first 15 s' },
    { range: { start: 4, seconds: 15 }, note: 'Using 4.0–19.0 s' }
  ])(
    'says "$note" under a long video and opens the trim from it',
    async ({ range, note }) => {
      const { emitted } = render(OpenjutsuPanel, {
        props: { ...longClip, range }
      })

      expect(screen.getByTestId('openjutsu-part')).toHaveTextContent(note)
      await userEvent.click(
        screen.getByRole('button', { name: 'Change the part used' })
      )

      expect(emitted('trim')).toHaveLength(1)
    }
  )

  it('says nothing about the part when the whole video fits', () => {
    render(OpenjutsuPanel, {
      props: {
        ...longClip,
        clipSeconds: 8,
        trimmed: false,
        range: { start: 0, seconds: 8 }
      }
    })

    expect(screen.queryByTestId('openjutsu-part')).toBeNull()
  })

  it('names the video over its cover and takes it out with the ✕', async () => {
    const { emitted } = render(OpenjutsuPanel, { props: longClip })

    expect(screen.getByTestId('openjutsu-video-caption')).toHaveTextContent(
      'dance.mp4 · 20 s'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove video' }))

    expect(emitted('removeVideo')).toHaveLength(1)
  })

  it.for([
    {
      slot: 'video',
      prompt: 'Upload video',
      input: 'openjutsu-video-file',
      file: new File(['clip'], 'other.mp4', { type: 'video/mp4' })
    },
    {
      slot: 'character',
      prompt: 'Add a character image',
      input: 'openjutsu-character-file',
      file: new File(['face'], 'face.png', { type: 'image/png' })
    }
  ] as const)(
    'takes a new $slot from its upload',
    async ({ slot, prompt, input, file }) => {
      const { emitted } = render(OpenjutsuPanel, { props: models })

      expect(screen.getByText(prompt)).toBeVisible()
      await userEvent.upload(screen.getByTestId(input), file)

      expect(emitted(slot)).toEqual([[file]])
    }
  )

  it('keeps the chosen character without a way to empty it', () => {
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

    await userEvent.type(
      screen.getByLabelText('Who to replace (optional)'),
      'the man'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Quality: 768p · Sharper' })
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
