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
    expect(screen.getAllByText('$3.49/hr')).toHaveLength(2)
    expect(
      screen.getAllByText(t('platform.pricing.storage.networkTitle', 'en'))
    ).toHaveLength(4)
    expect(screen.getAllByText('$0.091/GB/mo')).toHaveLength(2)
    expect(screen.getAllByText('$0.065/GB/mo')).toHaveLength(2)
    expect(screen.queryByText('$0.182/GB/mo')).toBeNull()
    expect(screen.queryByText('$0.13/GB/mo')).toBeNull()
    expect(screen.queryByText(/container disk/i)).toBeNull()
  })

  it.for(['en', 'zh-CN'] as const)(
    'warns once in %s that beta pricing may change',
    (locale) => {
      render(PricingSection, { props: { locale } })

      expect(
        screen.getByText(t('platform.pricing.betaNote', locale))
      ).toBeTruthy()
    }
  )

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
