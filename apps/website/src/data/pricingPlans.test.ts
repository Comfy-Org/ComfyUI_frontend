import { describe, expect, it } from 'vitest'

import { pricingPlans, subscribeUrl } from './pricingPlans'

describe('subscribeUrl', () => {
  it('builds a personal-tier deep link with no stop', () => {
    expect(subscribeUrl('standard', 'monthly')).toBe(
      'https://cloud.comfy.org/?pricing=standard&cycle=monthly'
    )
  })

  it('adds the credit stop for the team tier', () => {
    expect(subscribeUrl('team', 'yearly', 'team_700')).toBe(
      'https://cloud.comfy.org/?pricing=team&stop=team_700&cycle=yearly'
    )
  })
})

describe('pricingPlans feature ladder', () => {
  const featureKeysFor = (id: string) =>
    pricingPlans
      .find((plan) => plan.id === id)
      ?.featureGroups.flatMap((group) => group.features.map((f) => f.text))

  it('lists each paid plan only for what it adds over the previous one', () => {
    expect(featureKeysFor('standard')).toEqual([
      'pricing.feature.shortRuntime',
      'pricing.feature.addCredits'
    ])
    expect(featureKeysFor('creator')).toEqual(['pricing.feature.importModels'])
    expect(featureKeysFor('pro')).toEqual(['pricing.feature.longRuntime'])
  })

  it('never shows the short and long runtime lines on the same plan', () => {
    for (const plan of pricingPlans) {
      const keys = featureKeysFor(plan.id) ?? []
      const both =
        keys.includes('pricing.feature.shortRuntime') &&
        keys.includes('pricing.feature.longRuntime')
      expect(both).toBe(false)
    }
  })
})
