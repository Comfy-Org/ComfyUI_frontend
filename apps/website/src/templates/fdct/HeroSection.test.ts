// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

describe('fdct HeroSection', () => {
  it('renders the split hero with an autoplaying, looped video', () => {
    render(HeroSection)

    expect(screen.getByText('CREATIVE SERVICES')).toBeTruthy()

    const video = screen.getByLabelText('Forward Deployed Creatives')
    expect(video).toHaveProperty('autoplay', true)
    expect(video).toHaveProperty('loop', true)
    expect(video.getAttribute('poster')).toContain('FDCT_V4_thumb')

    expect(screen.getByRole('button', { name: /^(Play|Pause)$/ })).toBeTruthy()
  })

  it('renders the contact CTA', () => {
    render(HeroSection)

    const cta = screen.getByRole('link', { name: 'Contact us' })
    expect(cta.getAttribute('href')).toBeTruthy()
  })
})
