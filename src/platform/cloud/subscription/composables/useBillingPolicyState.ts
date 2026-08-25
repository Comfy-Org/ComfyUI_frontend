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

  // ENTERPRISE is a workspace-level, sales-managed plan and never self-serve.
  // Active, it takes the team policy states; lapsed, it keeps its own state so
  // it is never classified as plain WithoutActiveSubscription, which would
  // expose the personal subscribe upsell to a sales-managed customer.
  if (input.tier === 'ENTERPRISE') {
    return {
      kind: input.canAccessSubscriptionFeatures
        ? `${distribution}AndTeam`
        : `${distribution}EnterpriseWithoutActiveSubscription`
    }
  }

  if (input.isTeamPlan || input.tier === 'TEAM') {
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
    case null:
      return { kind: `${distribution}AndUnknown` }
    default:
      // COMPATIBILITY FALLBACK, NOT A POLICY SIGNAL.
      //
      // The tier union is generated from the backend spec and can gain values
      // without a frontend change, so this must not be a compile error. It
      // resolves to the restrictive state rather than Unknown because Unknown
      // grants topUpAccess 'allowed' — an unrecognised tier must not be handed
      // paid-plan access for the sole reason that this build does not know it.
      //
      // It is deliberately NOT business-correct: a sales-managed tier that is
      // genuinely active collapses to the same state as no subscription at all,
      // so any UI keyed off this can offer subscribe/upgrade to someone who is
      // already paying. Fail-closed on access, wrong on intent.
      //
      // Do not build cancellation, reactivation, pricing or upgrade decisions on
      // this branch. Those need explicit server-sent capabilities (canOpenPricing,
      // canChangePlan, canCancel, canReactivate) so a new tier cannot silently
      // inherit a frontend-computed policy.
      return { kind: `${distribution}WithoutActiveSubscription` }
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
