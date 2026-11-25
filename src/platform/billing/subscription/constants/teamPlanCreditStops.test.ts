import { describe, expect, it } from 'vitest'

import { getTeamPlanSlug } from './teamPlanCreditStops'

describe('getTeamPlanSlug', () => {
  it('maps the billing cycle to the per-credit team plan slug', () => {
    expect(getTeamPlanSlug('monthly')).toBe('team_per_credit_monthly')
    expect(getTeamPlanSlug('yearly')).toBe('team_per_credit_annual')
  })
})
