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
  it('prepends the highlighted savings row for edu-priced plans in education mode', () => {
    const result = planFeatures(eduPlan, true)

    expect(result[0]).toEqual({
      text: 'pricing.feature.educationalSavings',
      highlight: true
    })
    expect(result.slice(1)).toEqual(eduPlan.features)
  })

  it('leaves features unchanged outside education mode', () => {
    expect(planFeatures(eduPlan, false)).toBe(eduPlan.features)
  })

  it('does not add the savings row to plans without education pricing', () => {
    expect(planFeatures(planWithoutEduPricing, true)).toBe(
      planWithoutEduPricing.features
    )
  })
})
