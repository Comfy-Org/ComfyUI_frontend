import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { NavFeatured } from '@/data/mainNavigation'
import {
  captureNavFeaturedCardClicked,
  captureNavFeaturedCardViewed,
  readFlagVariant
} from '@/scripts/posthog'
import NavFeaturedCard from './NavFeaturedCard.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('@/scripts/posthog'))

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const featured: NavFeatured = {
  imageSrc: 'https://example.com/poster.webp',
  imageAlt: 'Featured clip',
  title: 'New release',
  cta: { label: 'Explore', href: '/launch' }
}

const variantFeatured: NavFeatured = {
  ...featured,
  analyticsId: 'launch',
  variants: {
    'bold-image': {
      imageSrc: 'https://example.com/bold.webp',
      imageAlt: 'Bold variant'
    }
  }
}

const cardProps = { dropdown: 'products', locale: 'en' } as const

beforeEach(() => {
  vi.mocked(readFlagVariant).mockReturnValue(undefined)
})

function renderVideoCard() {
  render(NavFeaturedCard, {
    props: {
      ...cardProps,
      featured: { ...featured, videoSrc: 'https://example.com/clip.webm' }
    }
  })
  const video = screen.getByLabelText('Featured clip')
  if (!(video instanceof HTMLVideoElement))
    throw new Error('Expected the featured media to be a video')
  return video
}

describe('NavFeaturedCard', () => {
  it('renders the image when no video is set', () => {
    render(NavFeaturedCard, { props: { ...cardProps, featured } })
    expect(
      screen.getByRole('img', { name: 'Featured clip' }).getAttribute('src')
    ).toBe(featured.imageSrc)
  })

  it('renders a non-looping video with the image as its poster when a video is set', () => {
    const video = renderVideoCard()
    expect(video.getAttribute('src')).toBe('https://example.com/clip.webm')
    expect(video.getAttribute('poster')).toBe(featured.imageSrc)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it.for([
    { reduced: false, autoplay: true },
    { reduced: true, autoplay: false }
  ])(
    'sets autoplay only without reduced motion (reduced: $reduced)',
    ({ reduced, autoplay }) => {
      motion.reduced = reduced
      onTestFinished(() => {
        motion.reduced = false
      })
      expect(renderVideoCard().hasAttribute('autoplay')).toBe(autoplay)
    }
  )

  it.for([
    { currentTime: 4, paused: false },
    { currentTime: 4.75, paused: true }
  ])(
    'is paused $paused once playback reaches $currentTime seconds',
    async ({ currentTime, paused }) => {
      const video = renderVideoCard()
      await video.play()
      video.currentTime = currentTime
      video.dispatchEvent(new Event('timeupdate'))
      expect(video.paused).toBe(paused)
    }
  )

  describe('analytics', () => {
    it('reports one view with the control variant when no flag has answered', () => {
      render(NavFeaturedCard, { props: { ...cardProps, featured } })
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledExactlyOnceWith({
        placement: 'launch',
        dropdown: 'products',
        href: '/launch',
        variant: 'control',
        locale: 'en'
      })
      expect(captureNavFeaturedCardClicked).not.toHaveBeenCalled()
    })

    it('reports a click without stopping navigation and keeps the view count', async () => {
      const user = userEvent.setup()
      render(NavFeaturedCard, {
        props: { ...cardProps, locale: 'zh-CN', featured: variantFeatured }
      })
      const link = screen.getByRole('link')
      let defaultPrevented: boolean | undefined
      link.addEventListener('click', (event) => {
        defaultPrevented = event.defaultPrevented
        event.preventDefault()
      })
      await user.click(link)
      expect(defaultPrevented).toBe(false)
      expect(captureNavFeaturedCardClicked).toHaveBeenCalledExactlyOnceWith({
        placement: 'launch',
        dropdown: 'products',
        href: '/launch',
        variant: 'control',
        locale: 'zh-CN'
      })
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledTimes(1)
    })

    it('renders and reports the variant the flag assigns', async () => {
      vi.mocked(readFlagVariant).mockReturnValue('bold-image')
      render(NavFeaturedCard, {
        props: { ...cardProps, featured: variantFeatured }
      })
      expect(
        screen.getByRole('img', { name: 'Bold variant' }).getAttribute('src')
      ).toBe('https://example.com/bold.webp')
      await userEvent.click(screen.getByRole('link'))
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'bold-image' })
      )
      expect(captureNavFeaturedCardClicked).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'bold-image' })
      )
    })

    it('renders the control card for a variant with no configured media', () => {
      vi.mocked(readFlagVariant).mockReturnValue('bold-image')
      render(NavFeaturedCard, { props: { ...cardProps, featured } })
      expect(
        screen.getByRole('img', { name: 'Featured clip' }).getAttribute('src')
      ).toBe(featured.imageSrc)
      expect(captureNavFeaturedCardViewed).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'control' })
      )
    })
  })
})
