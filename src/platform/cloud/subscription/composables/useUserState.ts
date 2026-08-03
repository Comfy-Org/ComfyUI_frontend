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
  tier: SubscriptionTier | null
}): UserState {
  if (!input.isCloud) return { kind: 'Local' }
  if (!input.isActiveSubscription) return { kind: 'CloudUnsubscribed' }

  switch (input.tier) {
    case 'FREE':
      return { kind: 'CloudFree' }
    case 'STANDARD':
      return { kind: 'CloudStandard' }
    case 'CREATOR':
      return { kind: 'CloudCreator' }
    case 'PRO':
      return { kind: 'CloudPro' }
    case 'FOUNDERS_EDITION':
      return { kind: 'CloudFounders' }
    case null:
      // An active Cloud subscription can be reported before its tier value
      // resolves; treat that gap as Free rather than guessing a paid tier.
      return { kind: 'CloudFree' }
  }
}

/**
 * Computes the current `UserState` from existing frontend signals only.
 * PoC: this does not plumb anything new through either backend — comfy-api
 * and the local backend stay exactly as they are today.
 */
export function useUserState() {
  const { isActiveSubscription, tier } = useBillingContext()

  const userState = computed<UserState>(() => {
    // Short-circuit before touching `tier`/`isActiveSubscription`: off Cloud
    // those signals are never populated, so reading them here is both
    // pointless and (in tests that only stub the Cloud-relevant fields) unsafe.
    if (!isCloud) return { kind: 'Local' }

    return deriveUserState({
      isCloud,
      isActiveSubscription: isActiveSubscription.value,
      tier: tier.value
    })
  })

  return { userState }
}
