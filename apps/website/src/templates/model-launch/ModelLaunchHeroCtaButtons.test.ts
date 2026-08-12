// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import ModelLaunchHeroCtaButtons from './ModelLaunchHeroCtaButtons.vue'

afterEach(() => {
  cleanup()
})

describe('ModelLaunchHeroCtaButtons', () => {
  it('renders only the primary CTA when no secondary CTA is given', () => {
    render(ModelLaunchHeroCtaButtons, {
      props: {
        primaryCta: { labelKey: 'cta.getStarted', href: '/get-started' },
        primaryVariant: 'solid'
      }
    })

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/get-started')
  })

  it('renders both CTAs with their own hrefs and targets when a secondary CTA is given', () => {
    render(ModelLaunchHeroCtaButtons, {
      props: {
        primaryCta: {
          labelKey: 'cta.getStarted',
          href: '/get-started',
          target: '_blank'
        },
        primaryVariant: 'outline-light',
        secondaryCta: { labelKey: 'nav.docs', href: '/docs' }
      }
    })

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('/get-started')
    expect(links[0].getAttribute('target')).toBe('_blank')
    expect(links[1].getAttribute('href')).toBe('/docs')
  })
})
