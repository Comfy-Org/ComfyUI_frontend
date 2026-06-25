import { describe, expect, it } from 'vitest'

import {
  TEAM_PLAN_SLUG_BY_CYCLE,
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops
} from './teamPlanCreditStops'

describe('mapApiTeamCreditStops', () => {
  it('derives usd, credits, discount and carries the backend id', () => {
    const mapped = mapApiTeamCreditStops([
      {
        id: 'team_700',
        credits: 147_700,
        yearly: { list_price_cents: 70_000, price_cents: 63_000 }
      }
    ])

    expect(mapped).toEqual([
      {
        id: 'team_700',
        usd: 700,
        credits: 147_700,
        discountPercentYearly: 10
      }
    ])
  })

  it('returns a 0% discount when the list price is zero', () => {
    const mapped = mapApiTeamCreditStops([
      {
        id: 'team_free',
        credits: 0,
        yearly: { list_price_cents: 0, price_cents: 0 }
      }
    ])

    expect(mapped[0].discountPercentYearly).toBe(0)
  })
})

describe('getStopDiscountedMonthlyUsd', () => {
  it('applies the full yearly discount for the yearly cycle', () => {
    expect(
      getStopDiscountedMonthlyUsd(
        { usd: 700, discountPercentYearly: 10 },
        'yearly'
      )
    ).toBe(630)
  })

  it('halves the discount for the monthly cycle', () => {
    expect(
      getStopDiscountedMonthlyUsd(
        { usd: 700, discountPercentYearly: 10 },
        'monthly'
      )
    ).toBe(665)
  })

  it('reads the stop discount so backend-driven stops are honored', () => {
    expect(
      getStopDiscountedMonthlyUsd(
        { usd: 1000, discountPercentYearly: 25 },
        'yearly'
      )
    ).toBe(750)
  })
})

describe('TEAM_PLAN_SLUG_BY_CYCLE', () => {
  it('maps the billing cycle to the per-credit team plan slug', () => {
    expect(TEAM_PLAN_SLUG_BY_CYCLE.monthly).toBe('team_per_credit_monthly')
    expect(TEAM_PLAN_SLUG_BY_CYCLE.yearly).toBe('team_per_credit_annual')
  })
})
