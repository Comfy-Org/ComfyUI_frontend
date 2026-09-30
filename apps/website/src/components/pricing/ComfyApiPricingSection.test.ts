import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/site'
import ComfyApiPricingSection from './ComfyApiPricingSection.vue'

describe('ComfyApiPricingSection', () => {
  it('renders one heading for the merged GPU/storage rates and plan limits', () => {
    render(ComfyApiPricingSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('pricing.comfyApi.heading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', {
        name: t('platform.pricing.heading', {}, { locale: 'en' })
      })
    ).toBeNull()
  })

  it('includes both the rate-card tables and the plan-limits table', () => {
    render(ComfyApiPricingSection, { props: { locale: 'en' } })

    expect(screen.getAllByText('RTX PRO 6000').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        t('pricing.comfyApi.metric.releases', {}, { locale: 'en' })
      ).length
    ).toBeGreaterThan(0)
  })

  it('hides the Learn More CTA by default', () => {
    render(ComfyApiPricingSection, { props: { locale: 'en' } })

    expect(
      screen.queryByRole('link', {
        name: t('pricing.comfyApi.learnMore', {}, { locale: 'en' })
      })
    ).toBeNull()
  })

  it('links the Learn More CTA to the Comfy API page when shown', () => {
    render(ComfyApiPricingSection, {
      props: { locale: 'en', showLearnMoreCta: true }
    })

    expect(
      screen.getByRole('link', {
        name: t('pricing.comfyApi.learnMore', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/platform/comfy-api/')
  })

  it('links the Learn More CTA to the localized Comfy API page for zh-CN', () => {
    render(ComfyApiPricingSection, {
      props: { locale: 'zh-CN', showLearnMoreCta: true }
    })

    expect(
      screen.getByRole('link', {
        name: t('pricing.comfyApi.learnMore', {}, { locale: 'zh-CN' })
      })
    ).toHaveAttribute('href', '/zh-CN/platform/comfy-api/')
  })
})
