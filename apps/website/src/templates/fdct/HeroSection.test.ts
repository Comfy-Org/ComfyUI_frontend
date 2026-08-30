// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('fdct HeroSection', () => {
  it('renders the split hero with an autoplaying looped video', () => {
    render(HeroSection)

    const video = screen.getByLabelText('Forward Deployed Creatives')
    expect(video.hasAttribute('autoplay')).toBe(true)
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.getAttribute('poster')).toContain('FDCT_V4_thumb')
  })

  it('renders the contact CTA', () => {
    render(HeroSection)

    const cta = screen.getByRole('link', { name: 'Contact us' })
    expect(cta.getAttribute('href')).toBeTruthy()
  })
})
