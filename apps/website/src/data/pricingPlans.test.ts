import { describe, expect, it } from 'vitest'

import type { PricingPlan } from './pricingPlans'
import { planFeatures, pricingPlans } from './pricingPlans'

const eduPlan = pricingPlans.find((plan) => plan.eduPriceKey)!

const planWithoutEduPricing: PricingPlan = {
  id: 'no-edu',
  labelKey: 'pricing.plan.free.label',
  ctaKey: 'pricing.plan.free.cta',
  ctaHref: () => '',
  features: [{ text: 'pricing.feature.addCredits' }]
}

describe('planFeatures', () => {
  it('prepends the monthly savings row for edu-priced plans on monthly billing', () => {
    const result = planFeatures(eduPlan, true, 'monthly')

    expect(result[0]).toEqual({
      text: 'pricing.feature.educationalSavings',
      highlight: true
    })
    expect(result.slice(1)).toEqual(eduPlan.features)
  })

  it('prepends the yearly savings row for edu-priced plans on yearly billing', () => {
    const result = planFeatures(eduPlan, true, 'yearly')

    expect(result[0]).toEqual({
      text: 'pricing.feature.educationalSavingsYearly',
      highlight: true
    })
    expect(result.slice(1)).toEqual(eduPlan.features)
  })

  it('leaves features unchanged outside education mode', () => {
    expect(planFeatures(eduPlan, false, 'yearly')).toBe(eduPlan.features)
  })

  it('does not add the savings row to plans without education pricing', () => {
    expect(planFeatures(planWithoutEduPricing, true, 'monthly')).toBe(
      planWithoutEduPricing.features
    )
  })
})
