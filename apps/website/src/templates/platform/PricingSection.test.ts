import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import {
  formatCreditsPerGbMonth,
  formatCreditsPerHour,
  formatStorageExampleAmount,
  formatUsdPerGbMonth,
  formatUsdPerHour,
  getStorageRate,
  rateCard
} from '@/data/rateCard'
import { STORAGE_TYPE_LABEL_KEYS } from '@/data/rateCardChecks'
import { t } from '@/i18n/translations'
import PricingSection from './PricingSection.vue'

const renderedStorageRates = rateCard.storage.filter(
  (storage) => STORAGE_TYPE_LABEL_KEYS[storage.storageType] !== 'containerDisk'
)

describe('PricingSection', () => {
  it('lists every GPU and storage rate', () => {
    render(PricingSection, { props: { locale: 'en' } })

    for (const gpu of ['RTX PRO 6000', 'H100 SXM', 'H200 SXM', 'B200']) {
      expect(screen.getAllByText(gpu)).toHaveLength(2)
    }
    for (const price of ['$4.54/hr', '$6.23/hr', '$7.71/hr', '$11.23/hr']) {
      expect(screen.getAllByText(price)).toHaveLength(2)
    }
    for (const credits of [
      '957.94/hr',
      '1314.53/hr',
      '1626.81/hr',
      '2369.53/hr'
    ]) {
      expect(screen.getAllByText(credits)).toHaveLength(1)
    }
    expect(screen.getAllByText('42.20/GB/mo')).toHaveLength(1)
    expect(
      screen.getAllByText(
        t('platform.pricing.storage.title', {}, { locale: 'en' })
      )
    ).toHaveLength(2)
    expect(screen.getAllByText('$0.20/GB/mo')).toHaveLength(2)
    expect(screen.queryAllByText('Container disk')).toHaveLength(0)
    expect(screen.queryAllByText('$0.15/GB/mo')).toHaveLength(0)
  })

  it('renders every rate-card value rather than a hardcoded copy', () => {
    render(PricingSection, { props: { locale: 'en' } })

    for (const gpu of rateCard.gpus) {
      expect(screen.getAllByText(gpu.label).length).toBeGreaterThan(0)
      expect(
        screen.getAllByText(formatUsdPerHour(gpu.pricePerHourUsd)).length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText(formatCreditsPerHour(gpu.creditsPerHour)).length
      ).toBeGreaterThan(0)
      expect(screen.getAllByText(`${gpu.vramGb} GB`).length).toBeGreaterThan(0)
    }

    for (const storage of renderedStorageRates) {
      expect(
        screen.getAllByText(formatUsdPerGbMonth(storage.pricePerGbMonthUsd))
          .length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText(formatCreditsPerGbMonth(storage.creditsPerGbMonth))
          .length
      ).toBeGreaterThan(0)
    }
  })

  it('computes the storage worked example from the network_standard rate', () => {
    render(PricingSection, { props: { locale: 'en' } })

    const amount = formatStorageExampleAmount(
      getStorageRate('network_standard')
    )
    const expected = t(
      'platform.pricing.storageExample',
      { amount },
      { locale: 'en' }
    )
    expect(screen.getAllByText(expected, { exact: false })).toHaveLength(2)
  })

  it('uses the platform heading by default and accepts overrides', () => {
    render(PricingSection, { props: { locale: 'en' } })
    expect(
      screen.getByText(t('platform.pricing.heading', {}, { locale: 'en' }))
    ).toBeTruthy()
  })

  it('shows the note only when provided', () => {
    render(PricingSection, {
      props: { locale: 'en', heading: 'Resource costs', note: 'Beta rates' }
    })

    expect(screen.getByText('Resource costs')).toBeTruthy()
    expect(screen.getByText('Beta rates')).toBeTruthy()
  })
})
