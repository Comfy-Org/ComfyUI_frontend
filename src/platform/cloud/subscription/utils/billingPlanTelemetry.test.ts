import type {
  BillingCycle,
  SubscriptionCheckoutTier
} from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import type {
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

import { toBillingCycle, toCurrentTier } from './billingPlanTelemetry'

describe('the plan in the telemetry vocabulary', () => {
  it.for<{
    tier: SubscriptionTier | null | undefined
    reported: SubscriptionCheckoutTier | undefined
  }>([
    { tier: 'FREE', reported: 'free' },
    { tier: 'STANDARD', reported: 'standard' },
    { tier: 'CREATOR', reported: 'creator' },
    { tier: 'PRO', reported: 'pro' },
    { tier: 'FOUNDERS_EDITION', reported: 'founder' },
    { tier: 'TEAM', reported: 'team' },
    { tier: 'ENTERPRISE', reported: undefined },
    { tier: null, reported: undefined },
    { tier: undefined, reported: undefined }
  ])('reports the tier $tier as $reported', ({ tier, reported }) => {
    expect(toCurrentTier(tier)).toBe(reported)
  })

  it.for<{
    duration: SubscriptionDuration | null | undefined
    reported: BillingCycle | undefined
  }>([
    { duration: 'MONTHLY', reported: 'monthly' },
    { duration: 'ANNUAL', reported: 'yearly' },
    { duration: null, reported: undefined },
    { duration: undefined, reported: undefined }
  ])(
    'reports the duration $duration as $reported',
    ({ duration, reported }) => {
      expect(toBillingCycle(duration)).toBe(reported)
    }
  )
})
