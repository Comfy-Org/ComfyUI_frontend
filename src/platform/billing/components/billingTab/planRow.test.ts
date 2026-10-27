import { describe, expect, it } from 'vitest'

import {
  deriveBillingTabLoad,
  derivePlanRow,
  formatPlanDate,
  planRowAction
} from '@/platform/billing/components/billingTab/planRow'
import type {
  PlanRowFacts,
  PlanRowState
} from '@/platform/billing/components/billingTab/planRow'

const baseFacts: PlanRowFacts = {
  subscriptionStatus: 'active',
  subscriptionState: null,
  billingStatus: 'paid',
  duration: 'MONTHLY',
  planName: 'Pro',
  renewalDate: '2026-11-15T00:00:00Z',
  endDate: null,
  scheduledChange: null,
  freeRuns: null
}

describe('derivePlanRow', () => {
  it.for<{
    case: string
    facts: Partial<PlanRowFacts>
    expected: PlanRowState
  }>([
    {
      case: 'an activating plan',
      facts: { subscriptionState: 'activating' },
      expected: { kind: 'activating', planName: 'Pro' }
    },
    {
      case: 'an activating plan without a renewal date',
      facts: { subscriptionState: 'activating', renewalDate: null },
      expected: { kind: 'activating', planName: 'Pro' }
    },
    {
      case: 'an activating plan the server has paused',
      facts: { subscriptionState: 'activating', billingStatus: 'paused' },
      expected: { kind: 'activating', planName: 'Pro' }
    },
    {
      case: 'an activating response with no plan name',
      facts: { subscriptionState: 'activating', planName: null },
      expected: { kind: 'unknown' }
    },
    {
      case: 'a served active state after activating clears',
      facts: { subscriptionState: 'active' },
      expected: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'monthly',
        nextInvoice: '2026-11-15T00:00:00Z',
        scheduledChange: null
      }
    },
    {
      case: 'an active monthly plan',
      facts: {},
      expected: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'monthly',
        nextInvoice: '2026-11-15T00:00:00Z',
        scheduledChange: null
      }
    },
    {
      case: 'an active yearly plan',
      facts: { duration: 'ANNUAL' },
      expected: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'yearly',
        nextInvoice: '2026-11-15T00:00:00Z',
        scheduledChange: null
      }
    },
    {
      case: 'an active plan with a scheduled change',
      facts: {
        scheduledChange: {
          planName: 'Standard',
          effectiveAt: '2026-11-15T00:00:00Z'
        }
      },
      expected: {
        kind: 'active',
        planName: 'Pro',
        cadence: 'monthly',
        nextInvoice: '2026-11-15T00:00:00Z',
        scheduledChange: {
          planName: 'Standard',
          effectiveAt: '2026-11-15T00:00:00Z'
        }
      }
    },
    {
      case: 'a canceled plan with an end date',
      facts: {
        subscriptionStatus: 'canceled',
        endDate: '2026-12-01T00:00:00Z'
      },
      expected: {
        kind: 'ending',
        planName: 'Pro',
        cadence: 'monthly',
        endsAt: '2026-12-01T00:00:00Z'
      }
    },
    {
      case: 'an ended plan with an end date',
      facts: { subscriptionStatus: 'ended', endDate: '2026-09-01T00:00:00Z' },
      expected: {
        kind: 'ended',
        planName: 'Pro',
        cadence: 'monthly',
        endedAt: '2026-09-01T00:00:00Z'
      }
    },
    {
      case: 'no subscription status',
      facts: { subscriptionStatus: null },
      expected: { kind: 'noPlan', freeRuns: null }
    },
    {
      case: 'no subscription status with free runs',
      facts: {
        subscriptionStatus: null,
        freeRuns: { remaining: 3, total: 5 }
      },
      expected: { kind: 'noPlan', freeRuns: { remaining: 3, total: 5 } }
    },
    {
      case: 'an unrecognised plan',
      facts: { planName: null },
      expected: { kind: 'unknown' }
    },
    {
      case: 'a paused subscription',
      facts: { billingStatus: 'paused' },
      expected: { kind: 'unknown' }
    },
    {
      case: 'an active plan without a renewal date',
      facts: { renewalDate: null },
      expected: { kind: 'unknown' }
    },
    {
      case: 'an active plan without a duration',
      facts: { duration: null },
      expected: { kind: 'unknown' }
    },
    {
      case: 'a canceled plan without an end date',
      facts: { subscriptionStatus: 'canceled' },
      expected: { kind: 'unknown' }
    },
    {
      case: 'an ended plan without an end date',
      facts: { subscriptionStatus: 'ended' },
      expected: { kind: 'unknown' }
    }
  ])('maps $case', ({ facts, expected }) => {
    expect(derivePlanRow({ ...baseFacts, ...facts })).toEqual(expected)
  })
})

describe('planRowAction', () => {
  const states: Record<string, PlanRowState> = {
    activating: { kind: 'activating', planName: 'Pro' },
    active: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'monthly',
      nextInvoice: '2026-11-15T00:00:00Z',
      scheduledChange: null
    },
    ending: {
      kind: 'ending',
      planName: 'Pro',
      cadence: 'monthly',
      endsAt: '2026-12-01T00:00:00Z'
    },
    ended: {
      kind: 'ended',
      planName: 'Pro',
      cadence: 'monthly',
      endedAt: '2026-09-01T00:00:00Z'
    },
    noPlan: { kind: 'noPlan', freeRuns: null },
    unknown: { kind: 'unknown' }
  }

  it.for([
    { state: 'activating', expected: 'manage' },
    { state: 'active', expected: 'manage' },
    { state: 'unknown', expected: 'manage' },
    { state: 'noPlan', expected: 'subscribe' },
    { state: 'ended', expected: 'choosePlan' },
    { state: 'ending', expected: null }
  ])('offers $expected for $state when granted', ({ state, expected }) => {
    expect(
      planRowAction(states[state], {
        canOpenPlans: true,
        planKind: 'self_serve'
      })
    ).toBe(expected)
  })

  it.for(Object.keys(states))(
    'offers nothing for %s when not granted',
    (key) => {
      expect(
        planRowAction(states[key], { canOpenPlans: false, planKind: null })
      ).toBeNull()
    }
  )

  it.for(Object.keys(states))(
    'replaces the action with Contact sales for %s when plan_kind is sales_managed',
    (key) => {
      expect(
        planRowAction(states[key], {
          canOpenPlans: false,
          planKind: 'sales_managed'
        })
      ).toBe('contactSales')
    }
  )
})

describe('deriveBillingTabLoad', () => {
  it.for<{
    case: string
    facts: Partial<Parameters<typeof deriveBillingTabLoad>[0]>
    expected: string
  }>([
    {
      case: 'billing and capabilities have loaded',
      facts: { billingInitialized: true, capabilitiesReady: true },
      expected: 'ready'
    },
    {
      case: 'billing has not loaded',
      facts: { billingInitialized: false, capabilitiesReady: true },
      expected: 'loading'
    },
    {
      case: 'capabilities have not loaded',
      facts: { billingInitialized: true, capabilitiesReady: false },
      expected: 'loading'
    },
    {
      case: 'billing failed',
      facts: { billingError: 'boom', capabilitiesReady: true },
      expected: 'error'
    },
    {
      case: 'capabilities settled without a snapshot',
      facts: {
        billingInitialized: true,
        capabilitiesReady: true,
        capabilitiesResolved: false
      },
      expected: 'error'
    }
  ])('is $expected when $case', ({ facts, expected }) => {
    expect(
      deriveBillingTabLoad({
        billingError: null,
        billingInitialized: false,
        capabilitiesReady: false,
        capabilitiesResolved: true,
        ...facts
      })
    ).toBe(expected)
  })
})

describe('formatPlanDate', () => {
  it.for([
    {
      case: 'omits the year on a monthly plan',
      cadence: 'monthly' as const,
      expected: 'November 15'
    },
    {
      case: 'keeps the year on a yearly plan',
      cadence: 'yearly' as const,
      expected: 'November 15, 2026'
    },
    {
      case: 'keeps the year when the cadence is unknown',
      cadence: null,
      expected: 'November 15, 2026'
    }
  ])('$case', ({ cadence, expected }) => {
    expect(formatPlanDate('2026-11-15T23:30:00Z', 'en-US', cadence)).toBe(
      expected
    )
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatPlanDate('not a date', 'en-US', 'yearly')).toBe('')
  })
})
