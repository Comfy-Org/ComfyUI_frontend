import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ComfyApiPricingSection from './ComfyApiPricingSection.vue'

describe('ComfyApiPricingSection', () => {
  it('renders one heading for the merged GPU/storage rates and plan limits', () => {
    render(ComfyApiPricingSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('pricing.comfyApi.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', {
        name: t('platform.pricing.heading', 'en')
      })
    ).toBeNull()
  })

  it('includes both the rate-card tables and the plan-limits table', () => {
    render(ComfyApiPricingSection, { props: { locale: 'en' } })

    expect(screen.getAllByText('RTX PRO 6000').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(t('pricing.comfyApi.metric.releases', 'en')).length
    ).toBeGreaterThan(0)
  })
})
