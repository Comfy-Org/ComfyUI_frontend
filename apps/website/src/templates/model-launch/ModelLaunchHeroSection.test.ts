import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useHeroLogo } from '../../composables/useHeroLogo'
import ModelLaunchHeroSection from './ModelLaunchHeroSection.vue'
import type { ModelLaunchHero } from './types'

vi.mock(import('../../composables/useHeroLogo'), { spy: true })
vi.mocked(useHeroLogo).mockReturnValue({ loaded: ref(false) })

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
})
