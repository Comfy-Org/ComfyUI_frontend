import type {
  BillingTelemetryEvent,
  PaymentIntentSource
} from '@comfyorg/account-core/billing'

import type { AttemptEvents } from '@/telemetry/attemptTelemetry'
import { createAttemptTelemetry } from '@/telemetry/attemptTelemetry'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/** The entry the customer arrived by, for the source it carried. */
type ResubscribeEntry = { readonly source?: PaymentIntentSource } | undefined

const describe = (entry: ResubscribeEntry) =>
  ({
    operation: 'resubscribe',
    source: 'billing_web_subscription',
    billing_client: 'sdk',
    payment_intent_source: entry?.source
  }) as const

const resubscribeEvents: AttemptEvents<ResubscribeEntry> = {
  begin: (entry) => [
    { ...describe(entry), stage: 'started', outcome: 'pending' }
  ],
  end: (entry, outcome, durationMs) =>
    outcome.kind === 'succeeded'
      ? {
          ...describe(entry),
          stage: 'succeeded',
          outcome: 'success',
          billing_op_id: outcome.billingOpId,
          duration_ms: durationMs
        }
      : {
          ...describe(entry),
          stage: 'failed',
          outcome: 'failure',
          ...outcome.failure,
          billing_op_id: outcome.billingOpId,
          decline_reason: outcome.declineReason,
          duration_ms: durationMs
        }
}

export function createResubscribeTelemetry({
  track = billingWebTelemetry.trackBillingEvent,
  now
}: {
  readonly track?: (event: BillingTelemetryEvent) => void
  readonly now?: () => number
} = {}) {
  return createAttemptTelemetry({ events: resubscribeEvents, track, now })
}
