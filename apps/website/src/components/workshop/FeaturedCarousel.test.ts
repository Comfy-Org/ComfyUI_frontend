import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogueFeature } from '@/lib/workshop/catalogue-features'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '@/test/fakeIntersectionObserver'
import FeaturedCarousel from './FeaturedCarousel.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const AUTOPLAY_MS = 6000
const RAF_MARGIN_MS = 100

function feature(
  title: string,
  extra: Partial<CatalogueFeature> = {}
): CatalogueFeature {
  const slug = title.toLowerCase().replaceAll(' ', '-')
  return {
    key: slug,
    badge: 'New',
    source: { label: 'ByteDance', logo: '/icons/bytedance.svg' },
    title,
    summary: `${title} summary`,
    href: `/hub/models/${slug}/`,
    cta: 'Try model',
    ctaLabel: `Try ${title}`,
    media: {
      name: title,
      thumbnail: { url: `/${slug}.webp`, kind: 'image' }
    },
    still: `/${slug}.webp`,
    ...extra
  }
}

const seedream = feature('Seedream 5.0 Pro', { price: '~9.5 credits/Image' })
const banana = feature('Nano Banana 2', { badge: 'Popular' })

function renderCarousel(features = [seedream, banana]) {
  return render(FeaturedCarousel, {
    props: { features, label: 'Featured models' }
  })
}

function shownTitle() {
  return screen.getByTestId('featured-title').textContent.trim()
}

async function advanceAutoplay(ms = AUTOPLAY_MS + RAF_MARGIN_MS) {
  await setAllIntersecting(true)
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

function setupAutoplayUser() {
  return userEvent.setup({
    advanceTimers: (ms) => vi.advanceTimersByTime(ms)
  })
}

describe('FeaturedCarousel', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('names itself a carousel of labelled slides with a progress button per item', () => {
    renderCarousel()

    const carousel = screen.getByRole('region', { name: 'Featured models' })
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel')
    const slide = within(carousel).getByRole('group', {
      name: 'Seedream 5.0 Pro, slide 1 of 2'
    })
    expect(slide).toHaveAttribute('aria-roledescription', 'slide')
    expect(
      screen.getByRole('button', { name: 'Seedream 5.0 Pro' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Nano Banana 2' })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('links the title and the call to action to the page, never one inside the other', () => {
    renderCarousel()

    const title = screen.getByRole('link', { name: 'Seedream 5.0 Pro' })
    const cta = screen.getByRole('link', { name: 'Try Seedream 5.0 Pro' })
    expect(title).toHaveAttribute('href', '/hub/models/seedream-5.0-pro/')
    expect(cta).toHaveAttribute('href', '/hub/models/seedream-5.0-pro/')
    expect(cta).toHaveTextContent(/^Try model$/)
    expect(title).not.toContainElement(cta)
    expect(cta).not.toContainElement(title)
    expect(screen.getByTestId('featured-badge')).toHaveTextContent('New')
    expect(screen.getByText('ByteDance')).toBeTruthy()
  })

  it('switches to the item a progress bar names', async () => {
    const user = userEvent.setup()
    renderCarousel()

    await user.click(screen.getByRole('button', { name: 'Nano Banana 2' }))

    expect(shownTitle()).toBe('Nano Banana 2')
    expect(screen.getByTestId('featured-badge')).toHaveTextContent('Popular')
    expect(
      screen.getByRole('button', { name: 'Nano Banana 2' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it.for([
    { item: 'Seedream 5.0 Pro', price: '~9.5 credits/Image' },
    { item: 'Nano Banana 2', price: undefined }
  ])(
    'shows the price exactly as received only when there is one ($item)',
    async ({ item, price }) => {
      const user = userEvent.setup()
      renderCarousel()

      await user.click(screen.getByRole('button', { name: item }))

      expect(screen.queryByTestId('featured-price')?.textContent.trim()).toBe(
        price
      )
    }
  )

  it('advances on its own and wraps back to the first item', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    renderCarousel()

    await advanceAutoplay()
    expect(shownTitle()).toBe('Nano Banana 2')

    await advanceAutoplay()
    expect(shownTitle()).toBe('Seedream 5.0 Pro')
  })

  it('pauses while hovered and resumes after the pointer leaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    renderCarousel()
    await nextTick()

    await user.hover(screen.getByTestId('featured-carousel'))
    await advanceAutoplay(AUTOPLAY_MS * 2)
    expect(shownTitle()).toBe('Seedream 5.0 Pro')

    await user.unhover(screen.getByTestId('featured-carousel'))
    await advanceAutoplay()
    expect(shownTitle()).toBe('Nano Banana 2')
  })

  it('pauses while a keyboard visitor is focused inside it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    renderCarousel()
    await nextTick()

    await user.tab()
    await advanceAutoplay(AUTOPLAY_MS * 2)

    expect(shownTitle()).toBe('Seedream 5.0 Pro')
  })

  it('never advances when reduced motion is preferred', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    motion.reduced = true
    renderCarousel()

    await advanceAutoplay(AUTOPLAY_MS * 3)

    expect(shownTitle()).toBe('Seedream 5.0 Pro')
  })

  it('shows a single item without progress bars', () => {
    renderCarousel([seedream])

    expect(shownTitle()).toBe('Seedream 5.0 Pro')
    expect(screen.queryByTestId('featured-progress')).toBeNull()
  })

  it('stays out of the way with nothing to feature', () => {
    renderCarousel([])

    expect(screen.queryByTestId('featured-carousel')).toBeNull()
  })
})
