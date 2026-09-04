// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ProductCardsSection from './ProductCardsSection.vue'

const products = ['local', 'cloud', 'platform', 'enterprise'] as const

const titleOf = (product: (typeof products)[number]) =>
  t(`products.${product}.title`, 'en')

describe('ProductCardsSection', () => {
  it('shows all four products by default', () => {
    render(ProductCardsSection, { props: { locale: 'en' } })

    for (const product of products) {
      expect(
        screen.getByRole('heading', { name: titleOf(product) })
      ).toBeTruthy()
    }
  })

  it('drops the excluded product', () => {
    render(ProductCardsSection, {
      props: { locale: 'en', excludeProduct: 'platform' }
    })

    expect(
      screen.queryByRole('heading', { name: titleOf('platform') })
    ).toBeNull()
    expect(screen.getByRole('heading', { name: titleOf('local') })).toBeTruthy()
  })
})
