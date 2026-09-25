import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import CloudPricingSection from './CloudPricingSection.vue'

function isBefore(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

describe('CloudPricingSection', () => {
  it('renders the free-tier banner between the billing toggle and the plan cards', () => {
    render(CloudPricingSection)

    const billingToggle = screen.getByText('Monthly')
    const banner = screen.getByText(
      'Start Comfy Cloud for free. Upgrade when ready.'
    )
    const planCards = screen.getByText('MOST POPULAR')

    expect(isBefore(billingToggle, banner)).toBe(true)
    expect(isBefore(banner, planCards)).toBe(true)
  })

  it('points the banner CTA at Comfy Cloud in a new tab', () => {
    render(CloudPricingSection)

    const cta = screen.getByRole('link', { name: 'TRY FREE' })
    expect(cta.getAttribute('href')).toBe('https://cloud.comfy.org')
    expect(cta.getAttribute('target')).toBe('_blank')
  })

  it('localizes the banner for the zh-CN page', () => {
    render(CloudPricingSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText('免费开始使用 Comfy Cloud，准备好了再升级。')
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: '免费试用' })).toBeTruthy()
    expect(screen.queryByText(/Start Comfy Cloud for free/)).toBeNull()
  })

  it.for([
    {
      locale: 'en',
      teamFeature: 'Invite members up to 50',
      enterpriseCta: 'Learn More'
    },
    {
      locale: 'zh-CN',
      teamFeature: '最多可邀请 50 名成员',
      enterpriseCta: '了解更多'
    }
  ] satisfies {
    locale: Locale
    teamFeature: string
    enterpriseCta: string
  }[])(
    'configures the Team feature and Enterprise CTA for $locale',
    ({ locale, teamFeature, enterpriseCta }) => {
      render(CloudPricingSection, { props: { locale } })

      expect(screen.getByText(teamFeature)).toBeTruthy()
      expect(
        screen.getByRole('link', { name: enterpriseCta }).getAttribute('href')
      ).toBe(getRoutes(locale).enterprise)
    }
  )
})
