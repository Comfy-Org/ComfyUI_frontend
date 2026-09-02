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
      ['platform.products.models.title', '/platform/models'],
      ['platform.products.builder.title', '/platform/builder']
    ] as const
    for (const [key, href] of cardLinks) {
      expect(
        screen.getByRole('link', { name: t(key, 'en') }).getAttribute('href')
      ).toBe(href)
    }
  })

  it('marks Models API as coming soon and links to its detail page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(screen.getByText(t('nav.badgeComingSoon', 'en'))).toBeTruthy()
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
