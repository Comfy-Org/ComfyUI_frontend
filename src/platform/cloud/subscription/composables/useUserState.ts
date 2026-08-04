import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'

import type { UserState } from '../userState'

/**
 * Pure derivation, kept separate from the composable so it can be unit
 * tested without mocking Vue reactivity or `useBillingContext`.
 */
export function deriveUserState(input: {
  isCloud: boolean
  isActiveSubscription: boolean
  isTeamPlan: boolean
  tier: SubscriptionTier | null
}): UserState {
  const distribution = input.isCloud ? 'Cloud' : 'Local'

  if (input.isTeamPlan) {
    return {
      kind: input.isActiveSubscription
        ? `${distribution}AndTeam`
        : `${distribution}TeamWithoutActiveSubscription`
    }
  }

  if (!input.isActiveSubscription) {
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
      return input.tier satisfies never
  }
}

/**
 * Computes the current `UserState` from existing frontend signals only.
 * PoC: this does not plumb anything new through either backend — comfy-api
 * and the local backend stay exactly as they are today.
 */
export function useUserState() {
  const { isActiveSubscription, isTeamPlan, tier } = useBillingContext()

  const userState = computed<UserState>(() =>
    deriveUserState({
      isCloud,
      isActiveSubscription: isActiveSubscription.value,
      isTeamPlan: isTeamPlan.value,
      tier: tier.value
    })
  )

  return { userState }
}
