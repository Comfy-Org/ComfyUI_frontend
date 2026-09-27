// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ProductsSection from './ProductsSection.vue'

describe('ProductsSection', () => {
  it('links each live product card to its platform page', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    const cardLinks = [
      ['platform.products.serverless.title', '/platform/comfy-api'],
      ['platform.products.builder.title', '/platform/builder']
    ] as const
    for (const [key, href] of cardLinks) {
      expect(
        screen.getByRole('link', { name: t(key, 'en') }).getAttribute('href')
      ).toBe(href)
    }
  })

  it('marks Models API as coming soon without a link', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(
      screen.queryByRole('link', {
        name: t('platform.products.models.title', 'en')
      })
    ).toBeNull()
    expect(screen.getByText(t('nav.badgeComingSoon', 'en'))).toBeTruthy()
  })

  it('renders no per-card CTA buttons — the whole card is the link', () => {
    render(ProductsSection, { props: { locale: 'en' } })

    expect(
      screen.queryByRole('link', { name: t('cta.getStarted', 'en') })
    ).toBeNull()
  })
})
