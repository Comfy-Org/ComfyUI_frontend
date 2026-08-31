// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ClosingCtaSection from './ClosingCtaSection.vue'

function ctaLabels() {
  return screen.getAllByRole('link').map((link) => link.textContent?.trim())
}

describe('ClosingCtaSection', () => {
  it('renders both platform CTAs at their external destinations', () => {
    render(ClosingCtaSection)

    expect(
      screen.getByRole('link', { name: 'Get Started' }).getAttribute('href')
    ).toBe('https://platform.comfy.org')
    expect(
      screen.getByRole('link', { name: 'Read the docs' }).getAttribute('href')
    ).toBe('https://docs.comfy.org/development/overview')
  })

  it('opens both CTAs in a new tab', () => {
    render(ClosingCtaSection)

    for (const link of screen.getAllByRole('link'))
      expect(link.getAttribute('target')).toBe('_blank')
  })

  it('localizes the heading and both CTA labels together', () => {
    render(ClosingCtaSection, { props: { locale: 'zh-CN' } })

    expect(ctaLabels()).not.toContain('Get Started')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
