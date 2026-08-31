// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ProductsSection from './ProductsSection.vue'

describe('ProductsSection', () => {
  it('links each product card to its platform page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    for (const href of [
      '/platform/serverless',
      '/platform/models',
      '/platform/builder'
    ]) {
      expect(hrefs).toContain(href)
    }
    expect(
      screen.getByText(t('platform.products.serverless.title', 'en'))
    ).toBeTruthy()
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
