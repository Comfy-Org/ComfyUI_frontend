import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import { useIntersectionObserver } from '@vueuse/core'

import ScrollCarousel from './ScrollCarousel.vue'

vi.mock(import('@vueuse/core'), { spy: true })

function markVisible() {
  vi.mocked(useIntersectionObserver).mockImplementation((_, callback) => {
    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    return {
      isSupported: computed(() => true),
      isActive: shallowRef(true),
      pause() {},
      resume() {},
      stop() {}
    }
  })
}

describe('ScrollCarousel autoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    markVisible()
  })

  it('advances one viewport after autoplayMs and wraps to the start at the end', async () => {
    render(ScrollCarousel, {
      props: { autoplayMs: 4000 },
      slots: { default: '<div>a</div><div>b</div>' }
    })
    const track = screen.getByTestId('scroll-carousel-track')
    Object.defineProperty(track, 'clientWidth', { value: 100 })
    Object.defineProperty(track, 'scrollWidth', { value: 200 })
    track.scrollBy = vi.fn()
    track.scrollTo = vi.fn()

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
    render(ScrollCarousel, {
      slots: { default: '<div>a</div><div>b</div>' }
    })
    const track = screen.getByTestId('scroll-carousel-track')
    track.scrollBy = vi.fn()

    await vi.advanceTimersByTimeAsync(10000)
    expect(track.scrollBy).not.toHaveBeenCalled()
  })
})
