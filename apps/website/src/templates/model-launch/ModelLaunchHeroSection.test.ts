import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { ModelLaunchHero } from './types'

import { useHeroLogo } from '@/composables/useHeroLogo'
import ModelLaunchHeroSection from './ModelLaunchHeroSection.vue'

vi.mock(import('@/composables/useHeroLogo'), { spy: true })
vi.mocked(useHeroLogo).mockReturnValue({ loaded: ref(false) })

function stubViewport(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(min-width: 768px)' && width >= 768,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
}

const hero: ModelLaunchHero = {
  layout: 'media-first',
  videoSrc: '/hero.mp4',
  posterSrc: '/hero.webp',
  mobileFallbackImageSrc: '/hero.webp',
  titleKey: 'chatgptImage25.hero.title'
}

describe('ModelLaunchHeroSection', () => {
  it('renders media before content for the media-first layout', () => {
    render(ModelLaunchHeroSection, { props: { hero } })
    const blocks = screen.getAllByTestId('model-launch-hero-block')

    expect(blocks).toHaveLength(2)
    expect(within(blocks[0]).getByAltText('')).toBeTruthy()
    expect(
      within(blocks[1]).getByRole('heading', {
        level: 1,
        name: /ChatGPT Images 2\.5/
      })
    ).toBeTruthy()
  })

  it.for([
    { titleSize: undefined, desktopClass: 'lg:text-6xl/tight' },
    { titleSize: 'compact' as const, desktopClass: 'lg:text-5xl/tight' }
  ])(
    'sizes the desktop heading by titleSize=$titleSize',
    ({ titleSize, desktopClass }) => {
      render(ModelLaunchHeroSection, {
        props: { hero: { ...hero, titleSize } }
      })

      expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
        desktopClass
      )
    }
  )

  it.for([
    { mediaOutline: undefined, outlined: false },
    { mediaOutline: 'gray' as const, outlined: true }
  ])(
    'outlines the hero media in gray when mediaOutline=$mediaOutline',
    ({ mediaOutline, outlined }) => {
      render(ModelLaunchHeroSection, {
        props: { hero: { ...hero, mediaOutline } }
      })

      expect(
        screen.getByAltText('').classList.contains('border-primary-warm-gray')
      ).toBe(outlined)
    }
  )

  it('shows the placeholder still above the content when a media-first hero has no video', () => {
    render(ModelLaunchHeroSection, {
      props: {
        hero: {
          layout: 'media-first',
          placeholderImageSrc: '/still.webp',
          titleKey: 'chatgptImage25.hero.title'
        }
      }
    })
    const blocks = screen.getAllByTestId('model-launch-hero-block')

    expect(blocks).toHaveLength(2)
    expect(within(blocks[0]).getByAltText('').getAttribute('src')).toBe(
      '/still.webp'
    )
    expect(within(blocks[1]).getByRole('heading', { level: 1 })).toBeTruthy()
  })

  it('spins the logo mask over the placeholder for overlay heroes that opt in', () => {
    render(ModelLaunchHeroSection, {
      props: {
        hero: {
          layout: 'overlay',
          placeholderImageSrc: '/still.webp',
          logoMaskImageSrc: '/still.webp',
          titleKey: 'chatgptImage25.hero.title'
        }
      }
    })

    const logoMask = screen.getByTestId('model-launch-hero-logo-mask')
    expect(
      within(logoMask).getByTestId('model-launch-hero-logo-fallback')
    ).toBeTruthy()
    expect(within(logoMask).queryByRole('img', { hidden: true })).toBeNull()
    expect(screen.queryByAltText('')).toBeNull()
  })

  it('keeps the still on phones when the hero has no mobile video', async () => {
    stubViewport(390)
    render(ModelLaunchHeroSection, { props: { hero } })

    await nextTick()

    expect(screen.getByAltText('').getAttribute('src')).toBe('/hero.webp')
    expect(screen.queryByLabelText(/ChatGPT Images 2\.5/)).toBeNull()
  })

  it('plays mobileVideoSrc on phones once mounted', async () => {
    stubViewport(390)
    render(ModelLaunchHeroSection, {
      props: { hero: { ...hero, mobileVideoSrc: '/hero-mobile.mp4' } }
    })

    const video = await screen.findByLabelText(/ChatGPT Images 2\.5/)
    expect(video.getAttribute('src')).toBe('/hero-mobile.mp4')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('loop')
    expect(screen.queryByAltText('')).toBeNull()
  })

  it('plays the full videoSrc on desktop even when a mobile video is set', async () => {
    stubViewport(1440)
    render(ModelLaunchHeroSection, {
      props: { hero: { ...hero, mobileVideoSrc: '/hero-mobile.mp4' } }
    })

    const video = await screen.findByLabelText(/ChatGPT Images 2\.5/)
    expect(video.getAttribute('src')).toBe('/hero.mp4')
  })
})
