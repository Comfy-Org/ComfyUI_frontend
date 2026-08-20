// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import HeroSection from './HeroSection.vue'

type HeroProps = ComponentProps<typeof HeroSection>

function renderHero(props: HeroProps = {}) {
  return render(HeroSection, { props })
}

describe('CareersHeroSection', () => {
  it('renders the hero video with the team photo poster and looping muted autoplay', () => {
    renderHero()

    const video = screen.getByLabelText('Comfy team')
    expect(video.getAttribute('src')).toBe(
      'https://media.comfy.org/website/careers/hero-audio.mp4'
    )
    expect(video.getAttribute('poster')).toBe(
      'https://media.comfy.org/website/careers/hero.webp'
    )
    expect(video.hasAttribute('autoplay')).toBe(true)
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.hasAttribute('muted')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
  })

  it('exposes localized accessible names for the video and its sound toggle', () => {
    renderHero({ locale: 'zh-CN' })

    expect(screen.getByLabelText('Comfy 团队')).toBeTruthy()
    expect(screen.getByRole('button', { name: /静音/ })).toBeTruthy()
  })
})
