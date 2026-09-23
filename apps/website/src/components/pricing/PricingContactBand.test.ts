import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PricingContactBand from './PricingContactBand.vue'

const baseProps = {
  labelKey: 'pricing.enterprise.label',
  descriptionKey: 'pricing.enterprise.description'
} as const

describe('PricingContactBand', () => {
  it('links to the contact page in the same tab by default', () => {
    render(PricingContactBand, { props: { ...baseProps, locale: 'en' } })

    const cta = screen.getByRole('link', { name: 'Contact Us' })
    expect(cta.getAttribute('href')).toBe('/contact')
    expect(cta.getAttribute('target')).toBeNull()
    expect(cta.getAttribute('rel')).toBeNull()
  })

  it('keeps an internal href override in the same tab', () => {
    render(PricingContactBand, {
      props: {
        ...baseProps,
        locale: 'en',
        href: '/enterprise',
        ctaKey: 'pricing.enterprise.learnMore'
      }
    })

    const cta = screen.getByRole('link', { name: 'Learn More' })
    expect(cta.getAttribute('href')).toBe('/enterprise')
    expect(cta.getAttribute('target')).toBeNull()
  })

  it('opens an external href override in a new tab', () => {
    render(PricingContactBand, {
      props: { ...baseProps, locale: 'en', href: 'https://example.com' }
    })

    const cta = screen.getByRole('link', { name: 'Contact Us' })
    expect(cta.getAttribute('href')).toBe('https://example.com')
    expect(cta.getAttribute('target')).toBe('_blank')
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('resolves the default contact route for the active locale', () => {
    render(PricingContactBand, { props: { ...baseProps, locale: 'zh-CN' } })

    expect(
      screen.getByRole('link', { name: '联系我们' }).getAttribute('href')
    ).toBe('/zh-CN/contact')
  })
})
