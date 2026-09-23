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
