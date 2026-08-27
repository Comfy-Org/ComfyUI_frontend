// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { pricingPlans } from '../../data/pricingPlans'
import { teamCreditTiers } from '../../data/teamCreditTiers'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PricingSection from './PricingSection.vue'

const MONTHS_PER_YEAR = 12
const LOCALES: Locale[] = ['en', 'zh-CN']

function firstNumber(key: TranslationKey, locale: Locale): number {
  const match = /[\d,]+/.exec(t(key, locale))
  if (!match) throw new Error(`no number in ${key} (${locale})`)
  return Number(match[0].replaceAll(',', ''))
}

describe('PricingSection credit allotment copy', () => {
  it('states the monthly allotment on the monthly cycle', () => {
    render(PricingSection, { props: { defaultBillingCycle: 'monthly' } })

    expect(screen.getAllByText('monthly credits')).toHaveLength(4)
    expect(screen.queryAllByText('credits per year')).toHaveLength(0)
    expect(screen.getByText('4,200')).toBeTruthy()
    expect(screen.getByText('21,100')).toBeTruthy()
    expect(screen.getByText('Generates ~380 5s videos*')).toBeTruthy()
  })

  it('states the whole-year allotment on the yearly cycle', () => {
    render(PricingSection, { props: { defaultBillingCycle: 'yearly' } })

    expect(screen.getAllByText('credits per year')).toHaveLength(4)
    expect(screen.queryAllByText('monthly credits')).toHaveLength(0)
    expect(screen.getByText('50,400')).toBeTruthy()
    expect(screen.getByText('253,200')).toBeTruthy()
    expect(screen.getByText('Generates ~4,560 5s videos*')).toBeTruthy()
  })

  it('scales the team allotment with the billing cycle', async () => {
    const user = userEvent.setup()
    render(PricingSection, { props: { defaultBillingCycle: 'monthly' } })

    expect(screen.getByText('147,700')).toBeTruthy()
    expect(screen.getByText('Generates ~13,405 5s videos*')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Yearly/ }))

    expect(screen.getByText('1,772,400')).toBeTruthy()
    expect(screen.getByText('Generates ~160,860 5s videos*')).toBeTruthy()
  })

  it('keeps every yearly figure at twelve times its monthly counterpart', () => {
    const annualPlans = pricingPlans.flatMap((plan) => {
      const { creditsKey, yearlyCreditsKey, estimateKey, yearlyEstimateKey } =
        plan
      return creditsKey && yearlyCreditsKey && estimateKey && yearlyEstimateKey
        ? [{ creditsKey, yearlyCreditsKey, estimateKey, yearlyEstimateKey }]
        : []
    })
    expect(annualPlans).toHaveLength(3)

    for (const plan of annualPlans) {
      for (const locale of LOCALES) {
        expect(firstNumber(plan.yearlyCreditsKey, locale)).toBe(
          firstNumber(plan.creditsKey, locale) * MONTHS_PER_YEAR
        )
        expect(firstNumber(plan.yearlyEstimateKey, locale)).toBe(
          firstNumber(plan.estimateKey, locale) * MONTHS_PER_YEAR
        )
      }
    }
  })

  it('derives every team video estimate from the same credits-per-video rate', () => {
    const videosPerCredit =
      firstNumber('pricing.plan.pro.estimate', 'en') /
      firstNumber('pricing.plan.pro.credits', 'en')

    for (const tier of teamCreditTiers) {
      expect(tier.videos).toBe(Math.round(tier.credits * videosPerCredit))
    }
  })

  it('re-labels the credits when the billing toggle changes', async () => {
    const user = userEvent.setup()
    render(PricingSection, { props: { defaultBillingCycle: 'monthly' } })

    await user.click(screen.getByRole('button', { name: /^Yearly/ }))

    expect(screen.getAllByText('credits per year')).toHaveLength(4)
    expect(screen.getByText('50,400')).toBeTruthy()
  })

  it('localizes the yearly credit label', () => {
    render(PricingSection, {
      props: { defaultBillingCycle: 'yearly', locale: 'zh-CN' }
    })

    expect(screen.getAllByText('年度积分')).toHaveLength(4)
    expect(screen.queryAllByText('每月积分')).toHaveLength(0)
  })
})
