// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ProductsSection from './ProductsSection.vue'

describe('ProductsSection', () => {
  it('links each live product to its platform page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    const cardLinks = [
      ['platform.products.serverless.title', '/platform/comfy-api'],
      ['platform.products.models.title', '/platform/router'],
      ['platform.products.builder.title', '/platform/builder']
    ] as const
    for (const [key, href] of cardLinks) {
      expect(
        screen.getByRole('link', { name: t(key, 'en') }).getAttribute('href')
      ).toBe(href)
    }
  })

  it('links Comfy Router to its detail page without a coming-soon badge', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(screen.queryByText(t('nav.badgeComingSoon', 'en'))).toBeNull()
    expect(
      screen.getByText(t('platform.products.models.learnMore', 'en'))
    ).toBeTruthy()
    expect(
      screen.getAllByText(t('platform.hero.getStarted', 'en'))
    ).toHaveLength(2)
  })

  it('uses one link per product card', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
