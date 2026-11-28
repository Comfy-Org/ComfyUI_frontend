import { describe, expect, it } from 'vitest'

import { getPlanCreditGrant } from './planCreditGrant'

describe('getPlanCreditGrant', () => {
  it.for([
    {
      name: 'a monthly Pro plan',
      plan: { tier: 'PRO', duration: 'MONTHLY' },
      grant: { credits: 21100, cycle: 'monthly' }
    },
    {
      name: 'a yearly Creator plan',
      plan: { tier: 'CREATOR', duration: 'ANNUAL' },
      grant: { credits: 88800, cycle: 'yearly' }
    },
    {
      name: "a Founder's Edition plan with no duration",
      plan: { tier: 'FOUNDERS_EDITION', duration: null },
      grant: { credits: 5461, cycle: 'monthly' }
    },
    {
      name: 'a Team plan, from its credit stop',
      plan: { tier: 'TEAM', duration: 'MONTHLY', teamMonthlyCredits: 50000 },
      grant: { credits: 50000, cycle: 'monthly' }
    },
    {
      name: 'a Team plan with no credit stop',
      plan: { tier: 'TEAM', duration: 'MONTHLY' },
      grant: null
    },
    {
      name: 'an Enterprise plan',
      plan: { tier: 'ENTERPRISE', duration: 'ANNUAL' },
      grant: null
    },
    {
      name: 'a paid plan with no duration',
      plan: { tier: 'STANDARD', duration: null },
      grant: null
    },
    { name: 'no plan', plan: { tier: null, duration: null }, grant: null }
  ] as const)('grants $name', ({ plan, grant }) => {
    expect(getPlanCreditGrant(plan)).toEqual(grant)
  })
})
