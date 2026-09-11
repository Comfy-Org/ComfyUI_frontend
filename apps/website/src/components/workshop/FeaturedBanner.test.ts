// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import FeaturedBanner from './FeaturedBanner.vue'

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
  })

  it('leads with the first model and links the whole slide to its page', () => {
    render(FeaturedBanner, { props: { models: [base, kling] } })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
    expect(screen.getByText('Text to Image')).toBeTruthy()
    expect(screen.getByTestId('featured-slide').getAttribute('href')).toBe(
      '/models/flux/'
    )
  })

  it('shows the model a pagination bar names', async () => {
    const user = userEvent.setup()
    render(FeaturedBanner, { props: { models: [base, kling] } })

    await user.click(screen.getByRole('button', { name: 'Kling' }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
    expect(screen.getByText(kling.summary ?? '')).toBeTruthy()
    expect(screen.getByTestId('featured-slide').getAttribute('href')).toBe(
      '/models/kling/'
    )
  })

  it('drops the pagination when there is nothing to page through', () => {
    render(FeaturedBanner, { props: { models: [base] } })
    expect(screen.queryByTestId('featured-pagination')).toBeNull()
  })

  it('renders video assets as video and replaces them when the slide changes', async () => {
    const user = userEvent.setup()
    render(FeaturedBanner, {
      props: {
        models: [
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
        ]
      }
    })
    expect(screen.getByTestId('featured-video').getAttribute('src')).toBe(
      '/video.mp4'
    )
    await user.click(screen.getByRole('button', { name: 'Flux' }))
    expect(screen.queryByTestId('featured-video')).toBeNull()
    expect(screen.getByAltText('').getAttribute('src')).toBe('/image.webp')
  })

  it('advances to the next slide on the autoplay cadence', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    render(FeaturedBanner, { props: { models: [base, kling] } })

    await advanceAutoplay()

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Kling')
  })

  it('pauses while hovered and resumes after the pointer leaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = setupAutoplayUser()
    render(FeaturedBanner, { props: { models: [base, kling] } })
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
    render(FeaturedBanner, { props: { models: [base, kling] } })
    await nextTick()

    await user.tab()
    await advanceAutoplay(AUTOPLAY_MS * 2)

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
  })

  it('does not autoplay when reduced motion is preferred', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    motion.reduced = true
    render(FeaturedBanner, { props: { models: [base, kling] } })

    await advanceAutoplay(AUTOPLAY_MS * 2)

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Flux')
  })
})
