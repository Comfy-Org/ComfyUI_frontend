import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import FeaturedBanner from './FeaturedBanner.vue'
import { modelSlides, studioSlide } from '../../lib/workshop/featured-slides'
import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('../../composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const AUTOPLAY_MS = 7000
const RAF_MARGIN_MS = 100

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: ['Inpainting'],
  provider: 'Black Forest Labs',
  modality: 'image',
  task: 'text-to-image',
  summary: 'Photorealistic images with professional text rendering.'
}

const kling: WorkshopModel = {
  ...base,
  slug: 'kling',
  name: 'Kling',
  href: '/models/kling/',
  modality: 'video',
  task: 'image-to-video',
  summary: 'Turns a still frame into a short video.'
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

describe('FeaturedBanner', () => {
  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
  })

  it('leads with the first model and links the whole slide to its page', () => {
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
    expect(screen.getByText('Text to Image')).toBeTruthy()
    expect(screen.getByTestId('featured-slide-link').getAttribute('href')).toBe(
      '/models/flux/'
    )
  })

  it('leads with Cinematic Studio when the catalogue promotes it', () => {
    render(FeaturedBanner, {
      props: {
        slides: [studioSlide('en'), ...modelSlides([base, kling], 'en')]
      }
    })

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Cinematic Studio'
    )
    expect(screen.getByRole('link', { name: 'Open studio' })).toHaveAttribute(
      'href',
      '/cinematic-studio'
    )
    expect(screen.queryByTestId('featured-docs-link')).toBeNull()
    expect(screen.getByRole('button', { name: 'Flux' })).toBeTruthy()
  })

  it('localizes the task without leaving its English suffix in the model name', () => {
    render(FeaturedBanner, {
      props: {
        locale: 'zh-CN',
        slides: modelSlides(
          [{ ...kling, name: 'Kling Image to Video' }],
          'zh-CN'
        )
      }
    })

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
    expect(screen.getByText('图像转视频')).toBeTruthy()
  })

  it('shows the model a pagination bar names', async () => {
    const user = userEvent.setup()
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })

    await user.click(screen.getByRole('button', { name: 'Kling' }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
    expect(screen.getByText(kling.summary ?? '')).toBeTruthy()
    expect(screen.getByTestId('featured-slide-link').getAttribute('href')).toBe(
      '/models/kling/'
    )
  })

  it('shows the docs button only when the provider has a docs section', async () => {
    const user = userEvent.setup()
    const undocumented: WorkshopModel = {
      ...kling,
      slug: 'magnific',
      name: 'Magnific',
      href: '/models/magnific/',
      provider: 'Magnific',
      routerId: 'magnific/upscale'
    }
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, undocumented], 'en') }
    })

    const docs = screen.getByTestId('featured-docs-link')
    expect(docs.getAttribute('href')).toBe(
      'https://docs.comfy.org/development/comfy-router/models#black-forest-labs'
    )
    expect(docs.getAttribute('target')).toBe('_blank')

    await user.click(screen.getByRole('button', { name: 'Magnific' }))
    expect(screen.queryByTestId('featured-docs-link')).toBeNull()
  })

  it('stays out of the way when the catalogue has nothing to feature', () => {
    render(FeaturedBanner, { props: { slides: [] } })
    expect(screen.queryByTestId('section-featured')).toBeNull()
  })

  it('drops the pagination when there is nothing to page through', () => {
    render(FeaturedBanner, { props: { slides: modelSlides([base], 'en') } })
    expect(screen.queryByTestId('featured-pagination')).toBeNull()
  })

  it('renders video assets as video and replaces them when the slide changes', async () => {
    const user = userEvent.setup()
    render(FeaturedBanner, {
      props: {
        slides: modelSlides(
          [
            {
              ...kling,
              thumbnailUrl: '/video.mp4',
              thumbnail: { url: '/video.mp4', kind: 'video' }
            },
            {
              ...base,
              thumbnailUrl: '/image.webp',
              thumbnail: { url: '/image.webp', kind: 'image' }
            }
          ],
          'en'
        )
      }
    })
    await setAllIntersecting(true)
    expect(screen.getByTestId('featured-video').getAttribute('src')).toBe(
      '/video.mp4'
    )
    await user.click(screen.getByRole('button', { name: 'Flux' }))
    expect(screen.queryByTestId('featured-video')).toBeNull()
    expect(screen.getByAltText('').getAttribute('src')).toBe('/image.webp')
  })

  // A model's still and its video sit in different fields, and most models
  // carry only the still. Leading with the ground instead would leave the
  // banner blank for nearly all of them.
  it('leads with the still when a model has no video', async () => {
    render(FeaturedBanner, {
      props: {
        slides: modelSlides([{ ...base, thumbnailUrl: '/still.webp' }], 'en')
      }
    })
    await setAllIntersecting(true)

    expect(screen.queryByTestId('featured-video')).toBeNull()
    expect(screen.getByAltText('').getAttribute('src')).toBe('/still.webp')
  })

  it('advances to the next slide on the autoplay cadence', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })

    await advanceAutoplay()

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
  })

  it('keeps a manually selected highlight until the reader changes it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en'), autoplay: false }
    })
    await user.click(screen.getByRole('button', { name: 'Kling' }))
    await advanceAutoplay(AUTOPLAY_MS * 2)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kling')
    expect(screen.getByRole('button', { name: 'Kling' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('pauses while hovered and resumes after the pointer leaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })
    await nextTick()

    await user.hover(screen.getByTestId('section-featured'))
    await advanceAutoplay(AUTOPLAY_MS * 2)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')

    await user.unhover(screen.getByTestId('section-featured'))
    await advanceAutoplay()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
  })

  it('pauses while a keyboard visitor is focused within the banner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })
    await nextTick()

    await user.tab()
    await advanceAutoplay(AUTOPLAY_MS * 2)

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
  })

  it('does not autoplay when reduced motion is preferred', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    motion.reduced = true
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })

    await advanceAutoplay(AUTOPLAY_MS * 2)

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
  })

  it('freezes rotation offscreen and in a hidden tab, then resumes where it stopped', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    render(FeaturedBanner, {
      props: { slides: modelSlides([base, kling], 'en') }
    })
    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(AUTOPLAY_MS)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
    await setAllIntersecting(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    await vi.advanceTimersByTimeAsync(AUTOPLAY_MS)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await advanceAutoplay()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
  })

  // The compact banner gives up height where outcome rows follow it. What it
  // must not give up is anything the reader came for.
  it.for([false, true])(
    'carries the same slide whether or not it is compact (%s)',
    (compact) => {
      render(FeaturedBanner, {
        props: { slides: modelSlides([base, kling], 'en'), compact }
      })
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
      expect(screen.getByText('Text to Image')).toBeTruthy()
      expect(
        screen.getByText(
          'Photorealistic images with professional text rendering.'
        )
      ).toBeTruthy()
      expect(
        screen.getByTestId('featured-slide-link').getAttribute('href')
      ).toBe('/models/flux/')
      expect(screen.getByRole('link', { name: /Try/i })).toHaveAttribute(
        'href',
        '/models/flux/'
      )
    }
  )
})
