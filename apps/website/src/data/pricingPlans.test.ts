import { describe, expect, it } from 'vitest'

import { subscribeUrl } from './pricingPlans'

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
