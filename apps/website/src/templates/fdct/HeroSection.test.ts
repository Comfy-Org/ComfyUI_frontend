// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('fdct HeroSection', () => {
  it('renders the split hero with a click-to-play video behind its poster', () => {
    render(HeroSection)

    // Click-to-play: the hero video must not autoplay and rests on its poster
    const video = screen.getByLabelText('Forward Deployed Creatives')
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.getAttribute('poster')).toContain('FDCT_V4_thumb')

    // The centered overlay play button floats over the poster
    const play = screen.getByRole('button', { name: 'Play' })
    expect(play.classList.contains('backdrop-blur-[9px]')).toBe(true)
  })

  it('renders the contact CTA', () => {
    render(HeroSection)

    const cta = screen.getByRole('link', { name: 'Contact us' })
    expect(cta.getAttribute('href')).toBeTruthy()
  })
})
