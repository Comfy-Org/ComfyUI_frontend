import { describe, expect, it } from 'vitest'

import { subscribeUrl } from './pricingPlans'

// Locks the cloud pricing-table deep-link contract (FE-1104):
// ?pricing=<tier>[&stop=team_n]&cycle=.
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
