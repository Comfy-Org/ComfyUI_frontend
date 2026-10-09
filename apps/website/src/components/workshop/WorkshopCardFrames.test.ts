import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import WorkshopCardFrames from './WorkshopCardFrames.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const FRAME_MS = 3200
const frames = ['/covers/a.webp', '/covers/b.webp', '/covers/c.webp']

function shownFrame() {
  const shown = screen
    .getAllByTestId('model-card-frame')
    .filter((frame) => frame.dataset.shown === 'true')
  expect(shown).toHaveLength(1)
  return shown[0].getAttribute('src')
}

describe('WorkshopCardFrames', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    vi.useFakeTimers()
  })

  it('lazy-loads every frame and leads with the first', () => {
    render(WorkshopCardFrames, { props: { frames } })

    const images = screen.getAllByTestId('model-card-frame')
    expect(images.map((image) => image.getAttribute('src'))).toEqual(frames)
    for (const image of images) {
      expect(image).toHaveAttribute('loading', 'lazy')
      expect(image).toHaveAttribute('decoding', 'async')
    }
    expect(shownFrame()).toBe(frames[0])
  })

  it('cross-fades through the frames while on screen and loops', async () => {
    render(WorkshopCardFrames, { props: { frames } })
    await setAllIntersecting(true)

    const seen = [shownFrame()]
    for (let step = 0; step < frames.length; step++) {
      await vi.advanceTimersByTimeAsync(FRAME_MS)
      await nextTick()
      seen.push(shownFrame())
    }

    expect(seen).toEqual([...frames, frames[0]])
  })

  it('holds its frame while off screen', async () => {
    render(WorkshopCardFrames, { props: { frames } })
    await setAllIntersecting(false)

    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    await nextTick()

    expect(shownFrame()).toBe(frames[0])
  })

  it('shows only the first frame, still, for reduced motion', async () => {
    motion.reduced = true
    render(WorkshopCardFrames, { props: { frames } })
    await setAllIntersecting(true)

    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    await nextTick()

    const images = screen.getAllByTestId('model-card-frame')
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      frames[0]
    ])
    expect(images[0].className).not.toContain('animate-cover-drift')
  })
})
