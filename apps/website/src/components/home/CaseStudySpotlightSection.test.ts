// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CaseStudySpotlightSection from './CaseStudySpotlightSection.vue'

const stubs = {
  VideoPlayer: { template: '<div data-testid="video-player" />' },
  GlassCard: { template: '<div><slot /></div>' }
}

describe('CaseStudySpotlightSection', () => {
  it('links WATCH STORY to the Black Math watch page, keeping SEE ALL pointed at the directory', () => {
    render(CaseStudySpotlightSection, { global: { stubs } })

    expect(screen.getByRole('link', { name: 'WATCH STORY' })).toHaveProperty(
      'href',
      expect.stringContaining('/customers/videos/black-math')
    )
    expect(
      screen.getByRole('link', { name: 'SEE ALL CASE STUDIES' })
    ).toHaveProperty('href', expect.stringContaining('/customers'))
  })
})
