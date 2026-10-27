import type {
  BillingFailure,
  BillingPortalTarget,
  BillingTelemetryFailure
} from '@comfyorg/account-core/billing'

import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

function failureOfPortalRefusal({
  code,
  httpStatus
}: BillingFailure): BillingTelemetryFailure {
  if (code === 'MALFORMED_RESPONSE') return { failure_category: 'unknown' }
  return {
    failure_category: httpStatus === undefined ? 'network' : 'api_rejected'
  }
}

type PortalStage =
  | { readonly stage: 'opened' }
  | { readonly stage: 'returned' }
  | { readonly stage: 'failed'; readonly refusal: BillingFailure }

export function reportPortal(
  target: BillingPortalTarget,
  event: PortalStage
): void {
  const base = { operation: 'portal', target, billing_client: 'sdk' } as const
  billingWebTelemetry.trackBillingEvent(
    event.stage === 'failed'
      ? {
          ...base,
          stage: 'failed',
          outcome: 'failure',
          ...failureOfPortalRefusal(event.refusal)
        }
      : { ...base, stage: event.stage, outcome: 'pending' }
  )
}
