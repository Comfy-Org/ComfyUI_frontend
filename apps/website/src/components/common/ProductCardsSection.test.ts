// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ProductCardsSection from './ProductCardsSection.vue'

function cardHrefs() {
  return screen.getAllByRole('link').map((link) => link.getAttribute('href'))
}

function ctaVariants() {
  return [...document.querySelectorAll('[data-variant]')].map((cta) =>
    cta.getAttribute('data-variant')
  )
}

describe('ProductCardsSection', () => {
  it('links each product card at its route, platform and enterprise included', () => {
    render(ProductCardsSection)

    expect(cardHrefs()).toEqual([
      '/download',
      '/cloud',
      '/platform',
      '/enterprise'
    ])
  })

  it('localizes every card route', () => {
    render(ProductCardsSection, { props: { locale: 'zh-CN' } })

    expect(cardHrefs()).toEqual([
      '/zh-CN/download',
      '/zh-CN/cloud',
      '/zh-CN/platform',
      '/zh-CN/enterprise'
    ])
  })

  it('drops the product the current page is already about', () => {
    render(ProductCardsSection, { props: { excludeProduct: 'platform' } })

    expect(cardHrefs()).toEqual(['/download', '/cloud', '/enterprise'])
  })

  it('forwards a shared CTA label to every card', () => {
    render(ProductCardsSection, { props: { ctaKey: 'products.local.cta' } })

    const labels = new Set(
      [...document.querySelectorAll('[data-variant]')].map((cta) =>
        cta.textContent?.trim()
      )
    )
    expect(labels.size).toBe(1)
  })

  it('forwards the CTA variant to every card', () => {
    render(ProductCardsSection, { props: { ctaVariant: 'outline' } })

    expect(ctaVariants()).toEqual(['outline', 'outline', 'outline', 'outline'])
  })

  it('defaults each card CTA to the default variant', () => {
    render(ProductCardsSection)

    expect(ctaVariants()).toEqual(['default', 'default', 'default', 'default'])
  })
})
