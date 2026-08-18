// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import FeaturedCarousel02 from './FeaturedCarousel02.vue'
import type { FeaturedSplitSlide } from './FeaturedCarousel02.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: vi.fn()
}))

// The carousel only auto-advances while on screen; happy-dom has no
// IntersectionObserver, so report every observed element as visible.
class VisibleIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback
  }
  callback: (entries: Array<{ isIntersecting: boolean }>) => void
  observe() {
    this.callback([{ isIntersecting: true }])
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

function makeSlides(): FeaturedSplitSlide[] {
  return [
    {
      id: 'a',
      media: { type: 'image', src: 'https://example.com/a.png', alt: 'A' },
      title: 'Slide A'
    },
    {
      id: 'b',
      media: { type: 'image', src: 'https://example.com/b.png', alt: 'B' },
      title: 'Slide B',
      autoplayMs: 1000
    },
    {
      id: 'c',
      media: { type: 'image', src: 'https://example.com/c.png', alt: 'C' },
      title: 'Slide C'
    }
  ]
}

function dot(title: string): HTMLElement {
  // Dots are the only buttons on image-only slides; each is labelled by its
  // slide's title.
  return screen.getByRole('button', { name: title })
}

function activeDotTitle(): string | undefined {
  return screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'true')
    ?.getAttribute('aria-label') as string | undefined
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

function setupUser() {
  return userEvent.setup({
    advanceTimers: (ms) => vi.advanceTimersByTime(ms)
  })
}

describe('FeaturedCarousel02', () => {
  beforeEach(() => {
    vi.mocked(prefersReducedMotion).mockReturnValue(false)
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver)
    // The suite asserts exact timer boundaries (4999ms vs 5000ms), so the
    // config's shouldAdvanceTime real-time drift must stay off.
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances after DEFAULT_AUTOPLAY_MS, honors per-slide delays, and wraps to the first slide', async () => {
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    await nextTick()
    expect(activeDotTitle()).toBe('Slide A')

    // Slide A has no autoplayMs → 5000ms default.
    await advance(4999)
    expect(activeDotTitle()).toBe('Slide A')
    await advance(1)
    expect(activeDotTitle()).toBe('Slide B')

    // Slide B carries its own 1000ms delay.
    await advance(1000)
    expect(activeDotTitle()).toBe('Slide C')

    // Advancing past the last slide wraps around to the first.
    await advance(5000)
    expect(activeDotTitle()).toBe('Slide A')
  })

  it('navigates on dot click', async () => {
    const user = setupUser()
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    await nextTick()
    await user.click(dot('Slide C'))
    expect(activeDotTitle()).toBe('Slide C')
  })

  it('does not auto-advance a single slide', async () => {
    render(FeaturedCarousel02, {
      props: { slides: makeSlides().slice(0, 1) }
    })
    await advance(20000)
    expect(screen.getByRole('heading', { name: 'Slide A' })).toBeTruthy()
    // A lone slide renders no pagination.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not auto-advance when reduced motion is preferred', async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    await advance(20000)
    expect(activeDotTitle()).toBe('Slide A')
  })

  it('pauses while hovered and resumes once the pointer leaves', async () => {
    const user = setupUser()
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    // Wait for the hover listeners to attach to the template ref.
    await nextTick()

    // Hovering a dot enters the carousel root as well.
    await user.hover(dot('Slide A'))
    await advance(20000)
    expect(activeDotTitle()).toBe('Slide A')

    await user.unhover(dot('Slide A'))
    await advance(5000)
    expect(activeDotTitle()).toBe('Slide B')
  })

  it('pauses for keyboard focus but not for pointer-click focus', async () => {
    const user = setupUser()
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    // Wait for the focus/keyboard listeners to attach to the template ref.
    await nextTick()

    // Tab onto a dot: keyboard-driven focus holds the carousel.
    await user.tab()
    expect(activeDotTitle()).toBe('Slide A')
    await advance(20000)
    expect(activeDotTitle()).toBe('Slide A')

    // A pointer click focuses the control too, but once the pointer leaves it
    // must not stall autoplay.
    await user.click(dot('Slide B'))
    await user.unhover(dot('Slide B'))
    await advance(1000)
    expect(activeDotTitle()).toBe('Slide C')
  })

  it('renders nothing to navigate for an empty slides array', () => {
    render(FeaturedCarousel02, { props: { slides: [] } })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
