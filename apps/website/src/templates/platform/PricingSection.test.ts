import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import PricingSection from './PricingSection.vue'

describe('PricingSection', () => {
  it('lists every GPU and storage rate', () => {
    render(PricingSection, { props: { locale: 'en' } })

    for (const gpu of ['RTX PRO 6000', 'H100', 'H200', 'B200']) {
      expect(screen.getAllByText(gpu)).toHaveLength(2)
    }
    for (const price of ['$4.54/hr', '$6.23/hr', '$7.71/hr', '$11.23/hr']) {
      expect(screen.getAllByText(price)).toHaveLength(2)
    }
    expect(
      screen.getAllByText(t('platform.pricing.storage.containerDisk', 'en'))
    ).toHaveLength(2)
    expect(screen.getAllByText('$0.20/GB/mo')).toHaveLength(6)
    expect(screen.getAllByText('$0.15/GB/mo')).toHaveLength(2)
  })

  it('uses the platform heading by default and accepts overrides', () => {
    render(PricingSection, { props: { locale: 'en' } })
    expect(screen.getByText(t('platform.pricing.heading', 'en'))).toBeTruthy()
  })

  it('shows the note only when provided', () => {
    render(PricingSection, {
      props: { locale: 'en', heading: 'Resource costs', note: 'Beta rates' }
    })

    expect(screen.getByText('Resource costs')).toBeTruthy()
    expect(screen.getByText('Beta rates')).toBeTruthy()
  })
})
