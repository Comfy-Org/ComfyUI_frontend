import { describe, expect, it } from 'vitest'

import type {
  Plan,
  SubscriptionTier,
  TeamCreditStopSummary,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import * as subscriptionTierRank from './subscriptionTierRank'

const { getPlanRank, isPlanDowngrade } = subscriptionTierRank

interface UpgradeEligibilityInput {
  currentTier: SubscriptionTier | null
  plans: Plan[]
  teamCreditStops: TeamCreditStops | null
  currentTeamCreditStop: TeamCreditStopSummary | null
}

function hasEligibleSubscriptionUpgrade(
  input: UpgradeEligibilityInput
): boolean {
  const candidate: unknown = Reflect.get(
    subscriptionTierRank,
    'hasEligibleSubscriptionUpgrade'
  )
  if (typeof candidate !== 'function') return false
  const check = candidate as (value: UpgradeEligibilityInput) => unknown
  return check(input) === true
}

function plan(
  tier: SubscriptionTier,
  available = true,
  duration: Plan['duration'] = 'MONTHLY'
): Plan {
  return {
    tier,
    duration,
    slug: `${tier.toLowerCase()}-${duration.toLowerCase()}`,
    price_cents: 1000,
    credits_cents: 1000,
    max_seats: 1,
    availability: { available },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1000,
      total_credits_cents: 1000
    }
  }
}

const teamStops: TeamCreditStops = {
  default_stop_index: 0,
  stops: [
    {
      id: 'team-200',
      credits: 42_200,
      monthly: { list_price_cents: 20_000, price_cents: 20_000 },
      yearly: { list_price_cents: 240_000, price_cents: 240_000 }
    },
    {
      id: 'team-400',
      credits: 84_400,
      monthly: { list_price_cents: 40_000, price_cents: 40_000 },
      yearly: { list_price_cents: 480_000, price_cents: 456_000 }
    }
  ]
}

function teamStop(id: string, credits: number): TeamCreditStopSummary {
  return { id, credits_monthly: credits, stop_usd: credits / 211 }
}

describe('subscriptionTierRank', () => {
  it('returns consistent order for ranked plans', () => {
    const yearlyPro = getPlanRank({ tierKey: 'pro', billingCycle: 'yearly' })
    const monthlyStandard = getPlanRank({
      tierKey: 'standard',
      billingCycle: 'monthly'
    })

    expect(yearlyPro).toBeLessThan(monthlyStandard)
  })

  it('identifies downgrades correctly', () => {
    const result = isPlanDowngrade({
      current: { tierKey: 'pro', billingCycle: 'yearly' },
      target: { tierKey: 'creator', billingCycle: 'monthly' }
    })

    expect(result).toBe(true)
  })

  it('treats lateral or upgrade moves as non-downgrades', () => {
    expect(
      isPlanDowngrade({
        current: { tierKey: 'standard', billingCycle: 'monthly' },
        target: { tierKey: 'creator', billingCycle: 'monthly' }
      })
    ).toBe(false)

    expect(
      isPlanDowngrade({
        current: { tierKey: 'creator', billingCycle: 'monthly' },
        target: { tierKey: 'creator', billingCycle: 'monthly' }
      })
    ).toBe(false)
  })

  it('treats unknown plans (e.g., founder) as non-downgrade cases', () => {
    const result = isPlanDowngrade({
      current: { tierKey: 'founder', billingCycle: 'monthly' },
      target: { tierKey: 'standard', billingCycle: 'monthly' }
    })

    expect(result).toBe(false)
  })
})

describe('hasEligibleSubscriptionUpgrade', () => {
  it('finds a higher available personal tier without counting billing-cycle changes', () => {
    expect(
      hasEligibleSubscriptionUpgrade({
        currentTier: 'STANDARD',
        plans: [
          plan('STANDARD', true, 'ANNUAL'),
          plan('CREATOR', true),
          plan('PRO', false)
        ],
        teamCreditStops: null,
        currentTeamCreditStop: null
      })
    ).toBe(true)
  })

  it('does not count unavailable higher personal tiers', () => {
    expect(
      hasEligibleSubscriptionUpgrade({
        currentTier: 'CREATOR',
        plans: [plan('PRO', false)],
        teamCreditStops: null,
        currentTeamCreditStop: null
      })
    ).toBe(false)
  })

  it.for(['PRO', 'FOUNDERS_EDITION', null] as const)(
    'fails closed for %s without a known higher personal tier',
    (currentTier) => {
      expect(
        hasEligibleSubscriptionUpgrade({
          currentTier,
          plans: [plan('STANDARD'), plan('CREATOR'), plan('PRO')],
          teamCreditStops: null,
          currentTeamCreditStop: null
        })
      ).toBe(false)
    }
  )

  it('finds a higher Team credit stop', () => {
    expect(
      hasEligibleSubscriptionUpgrade({
        currentTier: 'TEAM',
        plans: [],
        teamCreditStops: teamStops,
        currentTeamCreditStop: teamStop('team-200', 42_200)
      })
    ).toBe(true)
  })

  it('does not upgrade beyond the maximum Team credit stop', () => {
    expect(
      hasEligibleSubscriptionUpgrade({
        currentTier: 'TEAM',
        plans: [],
        teamCreditStops: teamStops,
        currentTeamCreditStop: teamStop('team-400', 84_400)
      })
    ).toBe(false)
  })
})
