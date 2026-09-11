// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchHero } from './types'

import ModelLaunchHeroSection from './ModelLaunchHeroSection.vue'

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
})
