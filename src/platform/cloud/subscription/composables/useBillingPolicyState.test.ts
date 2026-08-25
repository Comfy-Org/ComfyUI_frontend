import { describe, expect, it } from 'vitest'

import type { IngestSubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
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

  // The tier union is generated from the backend spec, so a value outside it is
  // reachable at runtime even though the type forbids it. It must resolve to the
  // restrictive state, not Unknown: Unknown grants topUpAccess 'allowed', which
  // would hand paid-plan access to a tier purely for being unrecognised.
  it.for([
    ['CloudWithoutActiveSubscription', true],
    ['LocalWithoutActiveSubscription', false]
  ] as const)(
    'resolves an unrecognised tier as %s (isCloud=%s)',
    ([kind, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: true,
          isTeamPlan: false,
          tier: 'SOME_FUTURE_TIER' as IngestSubscriptionTier
        })
      ).toEqual({ kind })
    }
  )

  // Sales-managed: active takes the team policy states; lapsed keeps its own
  // state so it is never shown the personal subscribe upsell.
  it.for<[string, boolean, boolean]>([
    ['CloudAndTeam', true, true],
    ['LocalAndTeam', true, false],
    ['CloudEnterpriseWithoutActiveSubscription', false, true],
    ['LocalEnterpriseWithoutActiveSubscription', false, false]
  ])(
    'resolves an ENTERPRISE tier as %s (canAccess=%s, isCloud=%s)',
    ([kind, canAccess, isCloud]) => {
      expect(
        deriveBillingPolicyState({
          isCloud,
          canAccessSubscriptionFeatures: canAccess,
          isTeamPlan: false,
          tier: 'ENTERPRISE'
        })
      ).toEqual({ kind })
    }
  )
})

// Characterization of the full pre-ENTERPRISE input space. Every row pins the
// behavior that existed before the ENTERPRISE branch was added; a change to
// any of these rows is a regression, not a refactor.
describe('deriveBillingPolicyState regression matrix', () => {
  const suffixTable: [
    IngestSubscriptionTier | null,
    boolean, // canAccessSubscriptionFeatures
    boolean, // isTeamPlan
    string
  ][] = [
    [null, true, false, 'AndUnknown'],
    [null, false, false, 'WithoutActiveSubscription'],
    [null, true, true, 'AndTeam'],
    [null, false, true, 'TeamWithoutActiveSubscription'],
    ['FREE', true, false, 'AndFree'],
    ['FREE', false, false, 'WithoutActiveSubscription'],
    ['FREE', true, true, 'AndTeam'],
    ['FREE', false, true, 'TeamWithoutActiveSubscription'],
    ['STANDARD', true, false, 'AndStandard'],
    ['STANDARD', false, false, 'WithoutActiveSubscription'],
    ['STANDARD', true, true, 'AndTeam'],
    ['STANDARD', false, true, 'TeamWithoutActiveSubscription'],
    ['CREATOR', true, false, 'AndCreator'],
    ['CREATOR', false, false, 'WithoutActiveSubscription'],
    ['CREATOR', true, true, 'AndTeam'],
    ['CREATOR', false, true, 'TeamWithoutActiveSubscription'],
    ['PRO', true, false, 'AndPro'],
    ['PRO', false, false, 'WithoutActiveSubscription'],
    ['PRO', true, true, 'AndTeam'],
    ['PRO', false, true, 'TeamWithoutActiveSubscription'],
    ['FOUNDERS_EDITION', true, false, 'AndFounders'],
    ['FOUNDERS_EDITION', false, false, 'WithoutActiveSubscription'],
    ['FOUNDERS_EDITION', true, true, 'AndTeam'],
    ['FOUNDERS_EDITION', false, true, 'TeamWithoutActiveSubscription'],
    ['TEAM', true, false, 'AndTeam'],
    ['TEAM', false, false, 'TeamWithoutActiveSubscription'],
    ['TEAM', true, true, 'AndTeam'],
    ['TEAM', false, true, 'TeamWithoutActiveSubscription']
  ]

  it.for(suffixTable)(
    'tier=%s canAccess=%s isTeamPlan=%s stays %s in both distributions',
    ([tier, canAccess, isTeamPlan, suffix]) => {
      for (const isCloud of [true, false]) {
        expect(
          deriveBillingPolicyState({
            isCloud,
            canAccessSubscriptionFeatures: canAccess,
            isTeamPlan,
            tier
          })
        ).toEqual({ kind: `${isCloud ? 'Cloud' : 'Local'}${suffix}` })
      }
    }
  )
})
