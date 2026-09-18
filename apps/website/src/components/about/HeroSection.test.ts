// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HeroSection from './HeroSection.vue'

const careersHref = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
    .find((href) => href?.includes('/careers'))

/**
 * The same pair of assertions as `CareersSection`, because the same mistake is
 * available in both: the about page carries two careers CTAs, and fixing the
 * href in one is easy to mistake for fixing it everywhere.
 */
describe('HeroSection', () => {
  it('keeps a Chinese reader in their locale', () => {
    render(HeroSection, { props: { locale: 'zh-CN' } })

    expect(careersHref()).toBe('/zh-CN/careers')
  })

  it('sends a Japanese reader to the English page, which is the one that exists', () => {
    render(HeroSection, { props: { locale: 'ja' } })

    expect(careersHref()).toBe('/careers')
  })
})
