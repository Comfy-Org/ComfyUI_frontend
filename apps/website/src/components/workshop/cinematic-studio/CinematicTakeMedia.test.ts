import { render, screen } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicTakeActions from './CinematicTakeActions.vue'
import CinematicTakeMedia from './CinematicTakeMedia.vue'

/** Renders the media with its reveal state held by a parent, as the frame does. */
function media(current: Extract<Take, { status: 'done' }>) {
  return render(
    defineComponent({
      setup: () => () =>
        h(CinematicTakeMedia, {
          current,
          height: '60svh',
          locale: 'en',
          revealed: false
        })
    })
  )
}

function take(kind: 'image' | 'video'): Extract<Take, { status: 'done' }> {
  return {
    id: 'a',
    shot: 1,
    letter: 'A',
    prompt: 'A lighthouse at dusk',
    modelSlug: 'model',
    aspect: '16:9',
    startedAt: 0,
    status: 'done',
    output: {
      kind,
      url: `blob:${kind}`,
      fileName: kind === 'video' ? 'take.mp4' : 'take.png'
    }
  }
}

describe('CinematicTakeMedia', () => {
  it('plays a video take and shows a still as an image', () => {
    const { unmount } = media(take('video'))
    expect(screen.getByLabelText('Generated video')).toHaveAttribute(
      'src',
      'blob:video'
    )
    unmount()
    media(take('image'))
    expect(screen.getByAltText('A lighthouse at dusk')).toHaveAttribute(
      'src',
      'blob:image'
    )
  })
})

describe('CinematicTakeVideo', () => {
  it('puts its own controls on a clip so it reads as a video', () => {
    media(take('video'))

    expect(screen.getByLabelText('Generated video')).not.toHaveAttribute(
      'controls'
    )
    expect(screen.getByTestId('cinematic-video-play')).toBeInTheDocument()
    expect(screen.getByTestId('cinematic-video-controls')).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument()
    expect(screen.getByTestId('cinematic-video-time')).toHaveTextContent(
      '0:00 / 0:00'
    )
  })

  it('plays from the big play button', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    media(take('video'))

    await userEvent.setup().click(screen.getByTestId('cinematic-video-play'))

    await vi.waitFor(() => expect(play).toHaveBeenCalled())
    play.mockRestore()
  })

  it('shows a still without video controls', () => {
    media(take('image'))
    expect(screen.queryByTestId('cinematic-video-controls')).toBeNull()
  })
})

describe('CinematicTakeActions', () => {
  it('offers a still, not a clip, as a reference', () => {
    const { unmount } = render(CinematicTakeActions, {
      props: { take: take('image') }
    })
    expect(
      screen.getByRole('button', { name: /use as reference/i })
    ).toBeInTheDocument()
    unmount()
    render(CinematicTakeActions, { props: { take: take('video') } })
    expect(
      screen.queryByRole('button', { name: /use as reference/i })
    ).not.toBeInTheDocument()
  })
})
