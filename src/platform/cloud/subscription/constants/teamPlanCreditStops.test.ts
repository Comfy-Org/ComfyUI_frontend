import { describe, expect, it } from 'vitest'

import {
  getStopDiscountedMonthlyUsd,
  getTeamPlanSlug,
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

describe('getTeamPlanSlug', () => {
  it('maps the billing cycle to the per-credit team plan slug', () => {
    expect(getTeamPlanSlug('monthly')).toBe('team_per_credit_monthly')
    expect(getTeamPlanSlug('yearly')).toBe('team_per_credit_annual')
  })
})

describe('getStopDiscountedMonthlyUsd with an extra discount', () => {
  // Team EDU: +5% of list on top of the stop's own cycle discount.
  it.for([
    [{ usd: 200, discountPercentYearly: 0 }, 'monthly', 190],
    [{ usd: 200, discountPercentYearly: 0 }, 'yearly', 190],
    [{ usd: 400, discountPercentYearly: 5 }, 'monthly', 370],
    [{ usd: 700, discountPercentYearly: 10 }, 'yearly', 595],
    [{ usd: 2500, discountPercentYearly: 20 }, 'yearly', 1875]
  ] as const)('discounts %s', (testCase) => {
    const [stop, cycle, expected] = testCase
    expect(getStopDiscountedMonthlyUsd(stop, cycle, 5)).toBe(expected)
  })

  it('defaults to no extra discount', () => {
    expect(
      getStopDiscountedMonthlyUsd(
        { usd: 700, discountPercentYearly: 10 },
        'yearly'
      )
    ).toBe(630)
  })
})
