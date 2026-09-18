import { describe, expect, it } from 'vitest'

import type { BillingPlansData } from '@comfyorg/account-core/billing'

import { projectBillingPlans } from './billingPlansView'

const DECODED: BillingPlansData = {
  current_plan_slug: 'creator_monthly',
  plans: [
    {
      slug: 'creator_monthly',
      tier: 'CREATOR',
      duration: 'MONTHLY',
      availability: { available: true },
      credits_cents: 6900n,
      max_seats: 1n,
      price_cents: 2800n,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2800n,
        total_credits_cents: 6900n
      }
    }
  ],
  team_credit_stops: {
    default_stop_index: 0,
    stops: [
      {
        id: 'team_200',
        credits: 20_000n,
        monthly: { list_price_cents: 20_000n, price_cents: 18_000n },
        yearly: { list_price_cents: 200_000n, price_cents: 170_000n }
      }
    ]
  }
}

describe('projectBillingPlans', () => {
  it('reads every catalog int64 back as the numbers the pricing surfaces hold', () => {
    const projected = projectBillingPlans(DECODED)

    expect(projected?.plans).toStrictEqual([
      {
        slug: 'creator_monthly',
        tier: 'CREATOR',
        duration: 'MONTHLY',
        availability: { available: true },
        credits_cents: 6900,
        max_seats: 1,
        price_cents: 2800,
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 2800,
          total_credits_cents: 6900
        }
      }
    ])
    expect(projected?.team_credit_stops).toStrictEqual({
      default_stop_index: 0,
      stops: [
        {
          id: 'team_200',
          credits: 20_000,
          monthly: { list_price_cents: 20_000, price_cents: 18_000 },
          yearly: { list_price_cents: 200_000, price_cents: 170_000 }
        }
      ]
    })
    expect(projected?.current_plan_slug).toBe('creator_monthly')
  })

  it('leaves the credit-stop ladder absent when the server sent none', () => {
    const withoutStops: BillingPlansData = {
      current_plan_slug: DECODED.current_plan_slug,
      plans: DECODED.plans
    }

    const projected = projectBillingPlans(withoutStops)

    expect(projected).toBeDefined()
    expect(projected && 'team_credit_stops' in projected).toBe(false)
    expect(projected?.plans).toHaveLength(1)
  })

  it('refuses a catalog with a price a number cannot hold exactly', () => {
    const tooLarge: BillingPlansData = {
      ...DECODED,
      plans: [
        {
          ...DECODED.plans[0],
          price_cents: BigInt(Number.MAX_SAFE_INTEGER) + 1n
        }
      ]
    }

    expect(projectBillingPlans(tooLarge)).toBeUndefined()
  })
})
