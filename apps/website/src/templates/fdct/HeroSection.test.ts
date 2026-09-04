// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import HeroSection from './HeroSection.vue'

describe('fdct HeroSection', () => {
  it('renders the split hero with an autoplaying, looping hero video', () => {
    render(HeroSection)

    const video = screen.getByLabelText(t('fdct.hero.title', 'en'))
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error('hero label is not on a <video>')
    }
    expect(video.autoplay).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.getAttribute('poster')).toContain('FDCT_V4_thumb')
  })

  it('renders the contact CTA', () => {
    render(HeroSection)

    const cta = screen.getByRole('link', { name: 'Contact us' })
    expect(cta.getAttribute('href')).toBeTruthy()
  })
})
