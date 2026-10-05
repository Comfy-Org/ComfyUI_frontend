import type {
  BillingCycle,
  SubscriptionCheckoutTier
} from '@comfyorg/account-core/billing'

import { toTierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

/** The plan a customer is on, in the telemetry vocabulary; absent when it names none. */
export function toCurrentTier(
  tier: SubscriptionTier | null | undefined
): SubscriptionCheckoutTier | undefined {
  if (tier === 'TEAM') return 'team'
  return (tier && toTierKey(tier)) || undefined
}

export function toBillingCycle(
  duration: SubscriptionDuration | null | undefined
): BillingCycle | undefined {
  if (!duration) return undefined
  return duration === 'ANNUAL' ? 'yearly' : 'monthly'
}
