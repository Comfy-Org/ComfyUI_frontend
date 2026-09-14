// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import EventsHeroSection from './EventsHeroSection.vue'

// The carousel autoplays real media through an IntersectionObserver, none of
// which bears on the hero's CTAs.
const stubs = { FeaturedCarousel01: { template: '<div />' } }

describe('EventsHeroSection', () => {
  it('anchors both CTAs to their on-page sections', () => {
    render(EventsHeroSection, { global: { stubs } })

    expect(
      screen.getByRole('link', { name: 'Browse events' }).getAttribute('href')
    ).toBe('#events-directory')

    const host = screen.getByRole('link', { name: 'Host an event' })
    expect(host.getAttribute('href')).toBe('#host-an-event')
    expect(host.getAttribute('target')).toBeNull()
  })
})
