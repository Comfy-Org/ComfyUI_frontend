// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('lifts the keyboard pause when the focused control is clicked', async () => {
    const user = setupUser()
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    await nextTick()

    // Keyboard focus on the first dot holds the carousel...
    await user.tab()
    await advance(20000)
    expect(activeDotTitle()).toBe('Slide A')

    // ...and clicking that same, already-focused dot fires no focusin, but
    // the pointer interaction must still lift the keyboard pause.
    await user.click(dot('Slide A'))
    await user.unhover(dot('Slide A'))
    await advance(5000)
    expect(activeDotTitle()).toBe('Slide B')
  })

  it('adopts the nearest snapped slide after a user scroll settles', async () => {
    const { container } = render(FeaturedCarousel02, {
      props: { slides: makeSlides() }
    })
    await nextTick()

    // The scroll-snap track has no ARIA role, so reach it by class.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const track = container.querySelector('.snap-x') as HTMLElement
    expect(track).toBeTruthy()

    // happy-dom has no layout, so give the slides deterministic offsets and
    // report a scroll position that lands nearest the third slide.
    // eslint-disable-next-line testing-library/no-node-access
    Array.from(track.children).forEach((child, index) => {
      Object.defineProperty(child, 'offsetLeft', {
        value: index * 300,
        configurable: true
      })
    })
    track.scrollLeft = 600
    track.dispatchEvent(new Event('scroll'))

    // The sync is debounced (150ms) so intermediate smooth-scrolls don't
    // flick the active index.
    await advance(150)
    expect(activeDotTitle()).toBe('Slide C')
  })

  it('resumes autoplay when keyboard focus leaves the carousel', async () => {
    const user = setupUser()
    render(FeaturedCarousel02, { props: { slides: makeSlides() } })
    await nextTick()

    // Keyboard focus on the first dot holds the carousel...
    await user.tab()
    await advance(20000)
    expect(activeDotTitle()).toBe('Slide A')

    // ...and once focus leaves the carousel entirely, autoplay resumes.
    dot('Slide A').blur()
    await advance(5000)
    expect(activeDotTitle()).toBe('Slide B')
  })

  it('renders nothing to navigate for an empty slides array', () => {
    render(FeaturedCarousel02, { props: { slides: [] } })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders eyebrow, body, CTAs, and tags for a fully populated slide', () => {
    render(FeaturedCarousel02, {
      props: {
        slides: [
          {
            id: 'full',
            media: {
              type: 'image',
              src: 'https://example.com/full.png',
              alt: 'Full'
            },
            eyebrow: 'New release',
            title: 'Full slide',
            body: 'Body copy for the slide.',
            primaryCta: { label: 'Explore it', href: '/explore' },
            secondaryCta: {
              label: 'Read docs',
              href: 'https://docs.example.com/',
              newTab: true
            },
            tags: ['Tag One', 'Tag Two']
          }
        ]
      }
    })

    expect(screen.getByText('New release')).toBeTruthy()
    expect(screen.getByText('Body copy for the slide.')).toBeTruthy()

    const primary = screen.getByRole('link', { name: 'Explore it' })
    expect(primary.getAttribute('href')).toBe('/explore')
    expect(primary.getAttribute('target')).toBeNull()
    expect(primary.getAttribute('rel')).toBeNull()

    const secondary = screen.getByRole('link', { name: 'Read docs' })
    expect(secondary.getAttribute('href')).toBe('https://docs.example.com/')
    expect(secondary.getAttribute('target')).toBe('_blank')
    expect(secondary.getAttribute('rel')).toBe('noopener noreferrer')

    expect(screen.getByText('Tag One')).toBeTruthy()
    expect(screen.getByText('Tag Two')).toBeTruthy()
  })

  it('opens a new-tab primary CTA and a same-tab secondary CTA', () => {
    render(FeaturedCarousel02, {
      props: {
        slides: [
          {
            id: 'ctas',
            media: {
              type: 'image',
              src: 'https://example.com/ctas.png',
              alt: 'CTAs'
            },
            title: 'CTA slide',
            primaryCta: {
              label: 'Open externally',
              href: 'https://example.com/',
              newTab: true
            },
            secondaryCta: { label: 'Stay here', href: '/internal' }
          }
        ]
      }
    })

    const primary = screen.getByRole('link', { name: 'Open externally' })
    expect(primary.getAttribute('target')).toBe('_blank')
    expect(primary.getAttribute('rel')).toBe('noopener noreferrer')

    const secondary = screen.getByRole('link', { name: 'Stay here' })
    expect(secondary.getAttribute('target')).toBeNull()
    expect(secondary.getAttribute('rel')).toBeNull()
  })

  it('mounts the video only on the active slide and shows posters elsewhere', async () => {
    const slides: FeaturedSplitSlide[] = [
      {
        id: 'v1',
        media: {
          type: 'video',
          src: 'https://example.com/one.mp4',
          poster: 'https://example.com/one.webp',
          alt: 'First clip'
        },
        title: 'First video',
        autoplayMs: 1000
      },
      {
        id: 'v2',
        media: {
          type: 'video',
          src: 'https://example.com/two.mp4',
          poster: 'https://example.com/two.webp',
          alt: 'Second clip'
        },
        title: 'Second video'
      }
    ]
    render(FeaturedCarousel02, { props: { slides } })
    await nextTick()

    // Active slide mounts the player; the inactive one shows its poster.
    expect(screen.getByLabelText('First clip')).toBeTruthy()
    expect(screen.queryByLabelText('Second clip')).toBeNull()
    expect(screen.getByAltText('Second clip')).toBeTruthy()

    await advance(1000)

    // Advancing swaps the mounted player, so audio can't leak across slides.
    expect(screen.queryByLabelText('First clip')).toBeNull()
    expect(screen.getByAltText('First clip')).toBeTruthy()
    expect(screen.getByLabelText('Second clip')).toBeTruthy()
  })
})
