import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicSequence from './CinematicSequence.vue'
import CinematicStage from './CinematicStage.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'
import CinematicTakeProgress from './CinematicTakeProgress.vue'

const done: Take = {
  id: 'a',
  shot: 1,
  letter: 'A',
  prompt: 'A lighthouse at dusk',
  modelSlug: 'model',
  aspect: '16:9',
  startedAt: 0,
  status: 'done',
  output: { kind: 'image', url: 'blob:take', fileName: 'take.png' }
}

describe('CinematicTakeFrame', () => {
  it('keeps the frame and a spinner until the picture has loaded', async () => {
    render(CinematicTakeFrame, { props: { current: done } })
    const figure = screen.getByRole('figure')
    expect(figure.getAttribute('style')).toContain('aspect-ratio: 16 / 9')
    expect(screen.getByLabelText('Loading the take')).toBeInTheDocument()

    await fireEvent.load(screen.getByAltText('A lighthouse at dusk'))

    expect(figure.getAttribute('style') ?? '').not.toContain('aspect-ratio')
    expect(screen.queryByLabelText('Loading the take')).toBeNull()
  })

  it('spins for nothing while an NSFW clip is withheld', async () => {
    const clip: Take = {
      ...done,
      output: {
        kind: 'video',
        url: 'blob:clip',
        fileName: 'clip.mp4',
        nsfw: true
      }
    }
    render(CinematicTakeFrame, { props: { current: clip } })
    const figure = screen.getByRole('figure')
    // No video mounts before the reveal, so `loaded` can never fire. The frame
    // still has to hold its size, so the spinner is what goes, not `loaded`.
    expect(figure.getAttribute('style')).toContain('aspect-ratio: 16 / 9')
    expect(screen.queryByLabelText('Loading the take')).toBeNull()
  })
})

describe('CinematicStage', () => {
  it('keeps the frame width until a finished video has loaded', async () => {
    const clip: Take = {
      ...done,
      output: { kind: 'video', url: 'blob:clip', fileName: 'clip.mp4' }
    }
    render(CinematicStage, {
      props: { reel: { takes: [clip] }, models: [] }
    })
    const column = screen.getByTestId('cinematic-take-column')
    expect(column.style.width).not.toBe('fit-content')

    await fireEvent(
      screen.getByLabelText('Generated video'),
      new Event('loadeddata')
    )

    expect(column.style.width).toBe('fit-content')
  })
})

describe('CinematicTakeProgress', () => {
  const rendering: Take = { ...done, status: 'rendering' }

  it('says what is being generated', () => {
    const { unmount } = render(CinematicTakeProgress, {
      props: { take: rendering }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Generating image')
    unmount()
    render(CinematicTakeProgress, { props: { take: rendering, video: true } })
    expect(screen.getByRole('status')).toHaveTextContent('Generating video')
  })
})

describe('CinematicSequence', () => {
  it('gives every thumbnail the same shape whatever the frame', () => {
    render(CinematicSequence, {
      props: {
        takes: [
          { ...done, id: 'a', letter: 'A', aspect: '21:9' },
          { ...done, id: 'b', letter: 'B', aspect: '9:16' }
        ]
      }
    })
    const thumbs = screen.getAllByRole('button')
    expect(thumbs.every((thumb) => !thumb.style.aspectRatio)).toBe(true)
    expect(new Set(thumbs.map((thumb) => thumb.className)).size).toBe(1)
  })
})

describe('take details over a finished take', () => {
  it('sit at the top of a clip, clear of its play bar', async () => {
    const clip: Take = {
      ...done,
      output: { kind: 'video', url: 'blob:clip', fileName: 'clip.mp4' }
    }
    const { unmount } = render(CinematicStage, {
      props: { reel: { takes: [clip] }, models: [] }
    })
    expect(screen.getByTestId('cinematic-take-overlay')).toHaveClass('top-0')
    unmount()
    render(CinematicStage, { props: { reel: { takes: [done] }, models: [] } })
    expect(screen.getByTestId('cinematic-take-overlay')).toHaveClass('bottom-0')
  })
})
