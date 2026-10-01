import type {
  BillingCycle,
  SubscriptionCheckoutTier
} from '@comfyorg/account-core/billing'

import {
  toBillingCycle,
  toCurrentTier
} from '@/platform/cloud/subscription/utils/billingPlanTelemetry'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'
import type {
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

interface SubscriptionCancellationMetadataOptions {
  cancelAt?: string
  duration?: SubscriptionDuration | null
  endDate?: string | null
  tier?: SubscriptionTier | null
}

export function getSubscriptionCancellationMetadata({
  cancelAt,
  duration,
  endDate,
  tier
}: SubscriptionCancellationMetadataOptions): SubscriptionCancellationMetadata {
  const effectiveEndDate = cancelAt ?? endDate
  return {
    source: 'cancel_plan_menu',
    current_tier: tier?.toLowerCase(),
    ...(duration
      ? { cycle: duration === 'ANNUAL' ? 'yearly' : 'monthly' }
      : {}),
    ...(effectiveEndDate ? { end_date: effectiveEndDate } : {})
  }
}

/** The plan being cancelled, as the cancel billing events carry it. */
export function getCancelBillingPlan({
  duration,
  tier
}: Pick<SubscriptionCancellationMetadataOptions, 'duration' | 'tier'>): {
  current_tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
} {
  return { current_tier: toCurrentTier(tier), cycle: toBillingCycle(duration) }
}
