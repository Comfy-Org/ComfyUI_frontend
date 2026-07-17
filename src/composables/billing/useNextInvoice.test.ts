import { describe, expect, it } from 'vitest'

import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import type { NextInvoiceInputs } from './useNextInvoice'
import { deriveNextInvoice } from './useNextInvoice'

function makeSubscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'STANDARD',
    duration: 'MONTHLY',
    planSlug: 'standard-monthly',
    renewalDate: '2026-08-01T00:00:00Z',
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    ...overrides
  }
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    slug: 'standard-monthly',
    tier: 'STANDARD',
    duration: 'MONTHLY',
    price_cents: 2000,
    credits_cents: 2000,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 2000,
      total_credits_cents: 2000
    },
    ...overrides
  }
}

// Both stop prices are per-month figures; price_cents is the discounted
// figure, kept distinct from list_price_cents and credits so a regression to
// either fails the amount assertions.
const teamCreditStops: TeamCreditStops = {
  default_stop_index: 0,
  stops: [
    {
      id: 'stop-320',
      credits: 67520,
      monthly: { list_price_cents: 32000, price_cents: 30400 },
      yearly: { list_price_cents: 32000, price_cents: 28800 }
    },
    {
      id: 'stop-640',
      credits: 135040,
      monthly: { list_price_cents: 64000, price_cents: 60800 },
      yearly: { list_price_cents: 64000, price_cents: 57600 }
    }
  ]
}

function makeInputs(
  overrides: Partial<NextInvoiceInputs> = {}
): NextInvoiceInputs {
  return {
    subscription: makeSubscription(),
    planSlug: 'standard-monthly',
    plans: [makePlan()],
    teamCreditStops: null,
    currentTeamCreditStop: null,
    ...overrides
  }
}

describe(deriveNextInvoice, () => {
  it('resolves a monthly invoice from the current plan price by slug', () => {
    expect(deriveNextInvoice(makeInputs())).toEqual({
      amountCents: 2000,
      renewalDate: '2026-08-01T00:00:00Z',
      duration: 'MONTHLY'
    })
  })

  it('prefers the subscribed team credit stop over the plan price', () => {
    const inputs = makeInputs({
      subscription: makeSubscription({ planSlug: 'team-pro-monthly' }),
      planSlug: 'team-pro-monthly',
      plans: [makePlan({ slug: 'team-pro-monthly', price_cents: 9999 })],
      teamCreditStops,
      currentTeamCreditStop: {
        id: 'stop-320',
        credits_monthly: 32000,
        stop_usd: 320
      }
    })

    expect(deriveNextInvoice(inputs)?.amountCents).toBe(30400)
  })

  it('multiplies the per-month yearly stop price by 12 for annual subs', () => {
    const inputs = makeInputs({
      subscription: makeSubscription({ duration: 'ANNUAL' }),
      teamCreditStops,
      currentTeamCreditStop: {
        id: 'stop-640',
        credits_monthly: 64000,
        stop_usd: 640
      }
    })

    expect(deriveNextInvoice(inputs)).toEqual({
      amountCents: 57600 * 12,
      renewalDate: '2026-08-01T00:00:00Z',
      duration: 'ANNUAL'
    })
  })

  it('uses the annual plan price_cents as the yearly total, unscaled', () => {
    const inputs = makeInputs({
      subscription: makeSubscription({
        duration: 'ANNUAL',
        planSlug: 'standard-yearly'
      }),
      planSlug: 'standard-yearly',
      plans: [
        makePlan({
          slug: 'standard-yearly',
          duration: 'ANNUAL',
          price_cents: 21600
        })
      ]
    })

    expect(deriveNextInvoice(inputs)).toEqual({
      amountCents: 21600,
      renewalDate: '2026-08-01T00:00:00Z',
      duration: 'ANNUAL'
    })
  })

  it('passes a null renewalDate through (scheduled-cancellation window)', () => {
    const inputs = makeInputs({
      subscription: makeSubscription({ renewalDate: null })
    })

    expect(deriveNextInvoice(inputs)?.renewalDate).toBeNull()
  })

  it('falls back to the plan price when the stop is not in the ladder', () => {
    const inputs = makeInputs({
      teamCreditStops,
      currentTeamCreditStop: {
        id: 'stop-unknown',
        credits_monthly: 1000,
        stop_usd: 10
      }
    })

    expect(deriveNextInvoice(inputs)?.amountCents).toBe(2000)
  })

  it.for([
    ['no subscription', { subscription: null }],
    [
      'inactive subscription',
      { subscription: makeSubscription({ isActive: false }) }
    ],
    [
      'cancelled subscription',
      { subscription: makeSubscription({ isCancelled: true }) }
    ],
    ['unresolvable plan slug', { planSlug: 'unknown-plan' }],
    [
      'annual sub whose slug resolves only to a monthly plan',
      { subscription: makeSubscription({ duration: 'ANNUAL' }) }
    ],
    ['empty plan list (legacy billing)', { plans: [] }],
    ['zero-price plan (free tier)', { plans: [makePlan({ price_cents: 0 })] }]
  ] satisfies [string, Partial<NextInvoiceInputs>][])(
    'returns null for %s',
    ([, overrides]) => {
      expect(deriveNextInvoice(makeInputs(overrides))).toBeNull()
    }
  )
})
