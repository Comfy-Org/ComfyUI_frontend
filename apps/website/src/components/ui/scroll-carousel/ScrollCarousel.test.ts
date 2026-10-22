import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import ScrollCarousel from './ScrollCarousel.vue'

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: vi.fn()
}))

function renderCarousel(props: { autoplayMs?: number } = {}) {
  render(ScrollCarousel, {
    props,
    slots: { default: '<div>a</div><div>b</div>' }
  })
  const track = screen.getByTestId('scroll-carousel-track')
  Object.defineProperty(track, 'clientWidth', { value: 100 })
  Object.defineProperty(track, 'scrollWidth', { value: 200 })
  track.scrollBy = vi.fn()
  track.scrollTo = vi.fn()
  return track
}

describe('ScrollCarousel autoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubIntersectionObserver()
    vi.mocked(prefersReducedMotion).mockReturnValue(false)
  })

  it('advances one viewport after autoplayMs and wraps to the start at the end', async () => {
    const track = renderCarousel({ autoplayMs: 4000 })
    await setAllIntersecting(true)

    await vi.advanceTimersByTimeAsync(4000)
    expect(track.scrollBy).toHaveBeenCalledWith({
      left: 100,
      behavior: 'smooth'
    })

    track.scrollLeft = 100
    track.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
  })

  it('stays put when autoplayMs is not set', async () => {
    const track = renderCarousel()
    await setAllIntersecting(true)

    await vi.advanceTimersByTimeAsync(10000)

    expect(track.scrollBy).not.toHaveBeenCalled()
    expect(track.scrollTo).not.toHaveBeenCalled()
  })

  it.for([
    {
      gate: 'reduced motion is preferred',
      reducedMotion: true,
      intersecting: true,
      hovered: false
    },
    {
      gate: 'the carousel is off screen',
      reducedMotion: false,
      intersecting: false,
      hovered: false
    },
    {
      gate: 'the pointer is over the track',
      reducedMotion: false,
      intersecting: true,
      hovered: true
    }
  ])(
    'does not advance while $gate',
    async ({ reducedMotion, intersecting, hovered }) => {
      vi.mocked(prefersReducedMotion).mockReturnValue(reducedMotion)
      const track = renderCarousel({ autoplayMs: 4000 })
      await setAllIntersecting(intersecting)
      track.dispatchEvent(new MouseEvent(hovered ? 'mouseenter' : 'mouseleave'))

      await vi.advanceTimersByTimeAsync(10000)

      expect(track.scrollBy).not.toHaveBeenCalled()
      expect(track.scrollTo).not.toHaveBeenCalled()
    }
  )
})
