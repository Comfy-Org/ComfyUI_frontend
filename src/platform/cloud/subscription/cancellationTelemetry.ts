import type { SubscriptionInfo } from '@/composables/billing/types'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'

interface CancellationMetadataInput {
  currentTier?: string | null
  duration?: SubscriptionInfo['duration']
  endDate?: string | null
}

export function createCancellationMetadata({
  currentTier,
  duration,
  endDate
}: CancellationMetadataInput): SubscriptionCancellationMetadata {
  return {
    source: 'cancel_plan_menu',
    current_tier: currentTier?.toLowerCase(),
    ...(duration
      ? {
          cycle: duration === 'ANNUAL' ? 'yearly' : 'monthly'
        }
      : {}),
    ...(endDate ? { end_date: endDate } : {})
  }
}
