import { render, screen } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '@/lib/workshop/cinematic-studio/reel'
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
