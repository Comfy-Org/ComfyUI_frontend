// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ClosingCtaSection from './ClosingCtaSection.vue'

describe('ClosingCtaSection', () => {
  it('uses the default get-started/docs CTAs when no overrides are given', () => {
    render(ClosingCtaSection, { props: { locale: 'en' } })

    expect(screen.getByRole('link', { name: 'Get Started' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read the docs' })).toBeTruthy()
  })

  it('uses the supplied primaryCta/secondaryCta overrides when given', () => {
    render(ClosingCtaSection, {
      props: {
        locale: 'en',
        primaryCta: { label: 'Request access', href: '/contact' },
        secondaryCta: { label: 'Explore supported models', href: '/models' }
      }
    })

    expect(screen.getByRole('link', { name: 'Request access' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Explore supported models' })
    ).toBeTruthy()
  })
})
