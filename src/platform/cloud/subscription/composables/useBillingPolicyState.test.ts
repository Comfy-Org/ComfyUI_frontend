import { describe, expect, it } from 'vitest'

import { deriveBillingPolicyState } from './useBillingPolicyState'

describe('deriveBillingPolicyState', () => {
  it.for<[string, boolean]>([
    ['LocalWithoutActiveSubscription', false],
    ['CloudWithoutActiveSubscription', true]
  ])('maps no active subscription to %s (isCloud=%s)', ([kind, isCloud]) => {
    expect(
      deriveBillingPolicyState({
        isCloud,
        canAccessSubscriptionFeatures: false,
        isTeamPlan: false,
        tier: null
      })
    ).toEqual({ kind })
  })

  it.for<
    [Parameters<typeof deriveBillingPolicyState>[0]['tier'], string, string]
  >([
    ['FREE', 'LocalAndFree', 'CloudAndFree'],
    ['STANDARD', 'LocalAndStandard', 'CloudAndStandard'],
    ['CREATOR', 'LocalAndCreator', 'CloudAndCreator'],
    ['PRO', 'LocalAndPro', 'CloudAndPro'],
    ['FOUNDERS_EDITION', 'LocalAndFounders', 'CloudAndFounders']
  ])(
    'maps an active subscription tier %s to %s off Cloud and %s on Cloud',
    ([tier, localKind, cloudKind]) => {
      expect(
        deriveBillingPolicyState({
          isCloud: false,
          canAccessSubscriptionFeatures: true,
          isTeamPlan: false,
          tier
        })
      ).toEqual({ kind: localKind })
      expect(
        deriveBillingPolicyState({
          isCloud: true,
          canAccessSubscriptionFeatures: true,
          isTeamPlan: false,
          tier
        })
      ).toEqual({ kind: cloudKind })
    }
  )

  it.for<[string, boolean]>([
    ['LocalAndUnknown', false],
    ['CloudAndUnknown', true]
  ])(
    'treats an active subscription with no resolved tier yet as %s (isCloud=%s)',
    ([kind, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: true,
          isTeamPlan: false,
          tier: null
        })
      ).toEqual({ kind })
    }
  )

  it.for<[string, boolean]>([
    ['LocalAndTeam', false],
    ['CloudAndTeam', true]
  ])('maps an active Team plan to %s (isCloud=%s)', ([kind, isCloud]) => {
    expect(
      deriveBillingPolicyState({
        isCloud,
        canAccessSubscriptionFeatures: true,
        isTeamPlan: true,
        tier: 'PRO'
      })
    ).toEqual({ kind })
  })

  it.for<[string, boolean]>([
    ['LocalTeamWithoutActiveSubscription', false],
    ['CloudTeamWithoutActiveSubscription', true]
  ])(
    'preserves an inactive Team plan as %s (isCloud=%s)',
    ([kind, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: false,
          isTeamPlan: true,
          tier: 'STANDARD'
        })
      ).toEqual({ kind })
    }
  )

  it.for<[string, boolean]>([
    ['LocalAndTeam', false],
    ['CloudAndTeam', true]
  ])(
    'resolves a TEAM tier as %s without the isTeamPlan signal (isCloud=%s)',
    ([kind, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: true,
          isTeamPlan: false,
          tier: 'TEAM'
        })
      ).toEqual({ kind })
    }
  )

  it.for<[string, boolean]>([
    ['LocalTeamWithoutActiveSubscription', false],
    ['CloudTeamWithoutActiveSubscription', true]
  ])(
    'preserves an inactive TEAM tier as %s without the isTeamPlan signal (isCloud=%s)',
    ([kind, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: false,
          isTeamPlan: false,
          tier: 'TEAM'
        })
      ).toEqual({ kind })
    }
  )
})
