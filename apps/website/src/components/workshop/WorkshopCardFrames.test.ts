import { fireEvent, render, screen } from '@testing-library/vue'
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

async function loadFrames() {
  await Promise.all(
    screen
      .getAllByTestId('model-card-frame')
      .map((frame) => fireEvent.load(frame))
  )
}

function shownFrame() {
  const shown = screen
    .getAllByTestId('model-card-frame')
    .filter((frame) => frame.parentElement?.classList.contains('opacity-100'))
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
    expect(images.map((image) => image.getAttribute('loading'))).toEqual(
      frames.map(() => 'lazy')
    )
    expect(images.map((image) => image.getAttribute('decoding'))).toEqual(
      frames.map(() => 'async')
    )
    expect(shownFrame()).toBe(frames[0])
  })

  it.for([
    { steps: 1, shown: frames[1] },
    { steps: 2, shown: frames[2] },
    { steps: 3, shown: frames[0] }
  ])(
    'shows $shown after $steps frame(s) on screen, looping back to the first',
    async ({ steps, shown }) => {
      render(WorkshopCardFrames, { props: { frames } })
      await loadFrames()
      await setAllIntersecting(true)

      await vi.advanceTimersByTimeAsync(FRAME_MS * steps)
      await nextTick()

      expect(shownFrame()).toBe(shown)
    }
  )

  it('holds its frame while off screen', async () => {
    render(WorkshopCardFrames, { props: { frames } })
    await loadFrames()
    await setAllIntersecting(false)

    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    await nextTick()

    expect(shownFrame()).toBe(frames[0])
  })

  it('waits on the current frame until the next one has loaded', async () => {
    render(WorkshopCardFrames, { props: { frames } })
    await setAllIntersecting(true)

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
