import type { BillingTelemetryFailureCategory } from '@comfyorg/account-core/billing'

import {
  toBillingCycle,
  toCurrentTier
} from '@/platform/cloud/subscription/utils/billingPlanTelemetry'
import type {
  SubscriptionCancellationMetadata,
  TelemetryDispatcher
} from '@/platform/telemetry/types'
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

/**
 * Reports a cancel flow as billing events. Once the customer confirms, the flow
 * is no longer abandoned. When the confirmed cancel becomes an operation, its
 * `billing.operation.*` events also own any failure, so `failed` is reported
 * only for a flow that has no operation.
 */
export function createCancelFlowReporter(
  telemetry: TelemetryDispatcher | null,
  getPlan: () => Pick<
    SubscriptionCancellationMetadataOptions,
    'duration' | 'tier'
  >
) {
  let confirmed = false
  let operationFollows = false
  const plan = () => {
    const { duration, tier } = getPlan()
    return {
      current_tier: toCurrentTier(tier),
      cycle: toBillingCycle(duration)
    }
  }

  return {
    intent() {
      telemetry?.trackBillingEvent({
        operation: 'cancel',
        stage: 'intent',
        outcome: 'pending',
        ...plan()
      })
    },
    confirmed(options: { operationFollows: boolean }) {
      confirmed = true
      operationFollows = options.operationFollows
    },
    abandoned() {
      if (confirmed) return
      telemetry?.trackBillingEvent({
        operation: 'cancel',
        stage: 'abandoned',
        outcome: 'pending',
        ...plan()
      })
    },
    failed(failureCategory: BillingTelemetryFailureCategory) {
      if (operationFollows) return
      telemetry?.trackBillingEvent({
        operation: 'cancel',
        stage: 'failed',
        outcome: 'failure',
        failure_category: failureCategory,
        ...plan()
      })
    }
  }
}
