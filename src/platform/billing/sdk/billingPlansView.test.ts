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
      action: 'subscribe',
      availability: { available: true },
      credits_cents: 6900n,
      feature_items: [
        {
          key: 'membersUpTo',
          params: { count: 3n },
          status: 'available',
          text: 'Up to 3 members'
        }
      ],
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
        monthly: {
          action: 'subscribe',
          list_price_cents: 20_000n,
          price_cents: 18_000n,
          period_charge_cents: 18_000n
        },
        yearly: {
          action: 'subscribe',
          list_price_cents: 200_000n,
          price_cents: 170_000n,
          period_charge_cents: 2_040_001n
        }
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
        action: 'subscribe',
        availability: { available: true },
        credits_cents: 6900,
        feature_items: [
          {
            key: 'membersUpTo',
            params: { count: 3 },
            status: 'available',
            text: 'Up to 3 members'
          }
        ],
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
          monthly: {
            action: 'subscribe',
            list_price_cents: 20_000,
            price_cents: 18_000,
            period_charge_cents: 18_000
          },
          yearly: {
            action: 'subscribe',
            list_price_cents: 200_000,
            price_cents: 170_000,
            period_charge_cents: 2_040_001
          }
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

  it('reads the raw credit grant back as a number when the server sends one', () => {
    const withGrant: BillingPlansData = {
      ...DECODED,
      plans: [{ ...DECODED.plans[0], credits: 7_400n }]
    }

    expect(projectBillingPlans(withGrant)?.plans[0].credits).toBe(7_400)
  })

  it('leaves an absent feature list absent', () => {
    const withoutFeatures: BillingPlansData = {
      ...DECODED,
      plans: [{ ...DECODED.plans[0], feature_items: undefined }]
    }

    const plan = projectBillingPlans(withoutFeatures)?.plans[0]

    expect(plan).toBeDefined()
    expect(plan && 'feature_items' in plan).toBe(false)
  })

  it('preserves feature items without interpolation params', () => {
    const withoutParams: BillingPlansData = {
      ...DECODED,
      plans: [
        {
          ...DECODED.plans[0],
          feature_items: [
            {
              key: 'shortRuntime',
              status: 'available',
              text: 'Short runtime'
            }
          ]
        }
      ]
    }

    expect(projectBillingPlans(withoutParams)?.plans[0].feature_items).toEqual(
      withoutParams.plans[0].feature_items
    )
  })

  it('refuses a catalog with a credit grant a number cannot hold exactly', () => {
    const tooLarge: BillingPlansData = {
      ...DECODED,
      plans: [
        { ...DECODED.plans[0], credits: BigInt(Number.MAX_SAFE_INTEGER) + 1n }
      ]
    }

    expect(projectBillingPlans(tooLarge)).toBeUndefined()
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

  it('drops an unsafe display count without rejecting the catalog', () => {
    const tooLarge: BillingPlansData = {
      ...DECODED,
      plans: [
        {
          ...DECODED.plans[0],
          feature_items: [
            {
              key: 'membersUpTo',
              params: { count: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
              status: 'available',
              text: 'Too many members'
            }
          ]
        }
      ]
    }

    expect(projectBillingPlans(tooLarge)?.plans[0].feature_items).toEqual([
      {
        key: 'membersUpTo',
        status: 'available',
        text: 'Too many members'
      }
    ])
  })
})
