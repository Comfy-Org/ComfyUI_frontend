// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import ProductsSection from './ProductsSection.vue'

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => true
}))

/** Each product card is covered by a full-bleed overlay link. Screen readers
 * announce those by their accessible name, so every one must have one. */
function overlayLink(name: string) {
  return screen.getByRole('link', { name })
}

describe('ProductsSection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('gives every full-card overlay link an accessible name', () => {
    render(ProductsSection)

    expect(overlayLink('Serverless API').getAttribute('href')).toBe(
      '/platform/serverless'
    )
    expect(overlayLink('Models API').getAttribute('href')).toBe(
      '/platform/models'
    )
    expect(overlayLink('Builder').getAttribute('href')).toBe(
      '/platform/builder'
    )
  })

  it('localizes every product route', () => {
    render(ProductsSection, { props: { locale: 'zh-CN' } })

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/'))

    expect(hrefs).toContain('/zh-CN/platform/serverless')
    expect(hrefs).toContain('/zh-CN/platform/models')
    expect(hrefs).toContain('/zh-CN/platform/builder')
    expect(hrefs).toContain('/zh-CN/enterprise')
  })

  it('points the shared Get Started CTAs at the console', () => {
    render(ProductsSection)

    const getStarted = screen.getAllByRole('link', { name: 'Get Started' })
    expect(getStarted).toHaveLength(2)
    for (const cta of getStarted) {
      expect(cta.getAttribute('href')).toBe('https://platform.comfy.org')
      expect(cta.getAttribute('target')).toBe('_blank')
    }
  })

  it('marks the Serverless card as beta', () => {
    render(ProductsSection)

    expect(screen.getByText('BETA')).toBeTruthy()
  })
})
