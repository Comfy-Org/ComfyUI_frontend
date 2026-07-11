import { describe, expect, it } from 'vitest'

import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import type { NextInvoiceInputs } from './useNextInvoice'
import { deriveNextInvoiceCents } from './useNextInvoice'

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

const teamCreditStops: TeamCreditStops = {
  default_stop_index: 0,
  stops: [
    {
      id: 'stop-320',
      credits: 32000,
      monthly: { list_price_cents: 32000, price_cents: 32000 },
      yearly: { list_price_cents: 384000, price_cents: 345600 }
    },
    {
      id: 'stop-640',
      credits: 64000,
      monthly: { list_price_cents: 64000, price_cents: 64000 },
      yearly: { list_price_cents: 768000, price_cents: 691200 }
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

describe(deriveNextInvoiceCents, () => {
  it('resolves the current plan price by slug', () => {
    expect(deriveNextInvoiceCents(makeInputs())).toBe(2000)
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

    expect(deriveNextInvoiceCents(inputs)).toBe(32000)
  })

  it('uses the yearly stop price for annual subscriptions', () => {
    const inputs = makeInputs({
      subscription: makeSubscription({ duration: 'ANNUAL' }),
      teamCreditStops,
      currentTeamCreditStop: {
        id: 'stop-640',
        credits_monthly: 64000,
        stop_usd: 640
      }
    })

    expect(deriveNextInvoiceCents(inputs)).toBe(691200)
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

    expect(deriveNextInvoiceCents(inputs)).toBe(2000)
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
    ['empty plan list (legacy billing)', { plans: [] }]
  ] satisfies [string, Partial<NextInvoiceInputs>][])(
    'returns null for %s',
    ([, overrides]) => {
      expect(deriveNextInvoiceCents(makeInputs(overrides))).toBeNull()
    }
  )
})
