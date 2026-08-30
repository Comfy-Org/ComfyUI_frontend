// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('fdct HeroSection', () => {
  it('renders the split hero with a muted autoplay video and poster fallback', () => {
    render(HeroSection)

    // Autoplay hero (#16205): the video starts on its own, muted so
    // browsers allow it, with the poster shown until playback begins
    const video = screen.getByLabelText<HTMLVideoElement>(
      'Forward Deployed Creatives'
    )
    expect(video.hasAttribute('autoplay')).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.getAttribute('poster')).toContain('FDCT_V4_thumb')
  })

  it('renders the contact CTA', () => {
    render(HeroSection)

    const cta = screen.getByRole('link', { name: 'Contact us' })
    expect(cta.getAttribute('href')).toBeTruthy()
  })
})
