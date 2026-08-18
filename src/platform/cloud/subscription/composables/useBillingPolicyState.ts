import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { IngestSubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'

import type { BillingPolicyState } from '../billingPolicyState'

/**
 * Pure derivation, kept separate from the composable so it can be unit
 * tested without mocking Vue reactivity or `useBillingContext`.
 */
export function deriveBillingPolicyState(input: {
  isCloud: boolean
  canAccessSubscriptionFeatures: boolean
  isTeamPlan: boolean
  tier: IngestSubscriptionTier | null
}): BillingPolicyState {
  const distribution = input.isCloud ? 'Cloud' : 'Local'

  if (input.isTeamPlan) {
    return {
      kind: input.canAccessSubscriptionFeatures
        ? `${distribution}AndTeam`
        : `${distribution}TeamWithoutActiveSubscription`
    }
  }

  if (!input.canAccessSubscriptionFeatures) {
    return { kind: `${distribution}WithoutActiveSubscription` }
  }

  switch (input.tier) {
    case 'FREE':
      return { kind: `${distribution}AndFree` }
    case 'STANDARD':
      return { kind: `${distribution}AndStandard` }
    case 'CREATOR':
      return { kind: `${distribution}AndCreator` }
    case 'PRO':
      return { kind: `${distribution}AndPro` }
    case 'FOUNDERS_EDITION':
      return { kind: `${distribution}AndFounders` }
    case 'TEAM':
      return { kind: `${distribution}AndTeam` }
    case null:
      return { kind: `${distribution}AndUnknown` }
    default:
      // The tier union comes from the backend spec and can gain values without
      // a frontend change. Treating an unrecognised tier as unknown keeps that
      // additive, at the cost of the compile-time exhaustiveness check.
      return { kind: `${distribution}AndUnknown` }
  }
}

/**
 * Computes the current billing policy state from existing frontend signals.
 * PoC: this does not plumb anything new through either backend — comfy-api
 * and the local backend stay exactly as they are today.
 */
export function useBillingPolicyState() {
  const { canAccessSubscriptionFeatures, isTeamPlan, tier } =
    useBillingContext()

  const billingPolicyState = computed<BillingPolicyState>(() =>
    deriveBillingPolicyState({
      isCloud,
      canAccessSubscriptionFeatures: canAccessSubscriptionFeatures.value,
      isTeamPlan: isTeamPlan.value,
      tier: tier.value
    })
  )

  return { billingPolicyState }
}
