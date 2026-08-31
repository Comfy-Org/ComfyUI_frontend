// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ProductsSection from './ProductsSection.vue'

describe('ProductsSection', () => {
  it('links each product card to its platform page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    const cardLinks = [
      ['platform.products.serverless.title', '/platform/serverless'],
      ['platform.products.models.title', '/platform/models'],
      ['platform.products.builder.title', '/platform/builder']
    ] as const
    for (const [key, href] of cardLinks) {
      expect(
        screen.getByRole('link', { name: t(key, 'en') }).getAttribute('href')
      ).toBe(href)
    }
  })

  it('sends the Builder card to the enterprise page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(
      screen
        .getByRole('link', {
          name: t('platform.products.builder.enterpriseCta', 'en')
        })
        .getAttribute('href')
    ).toBe('/enterprise')
  })
})
