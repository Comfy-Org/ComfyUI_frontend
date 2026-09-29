import type { BillingOperationTelemetryEvent } from '@comfyorg/account-core/billing'
import { BILLING_OPERATION_TELEMETRY_EVENT } from '@comfyorg/account-core/billing'

import type { BillingTelemetryEvent } from '@/platform/telemetry/types'

/**
 * The lifecycle's event onto the `billing.operation.*` payload the poller
 * emits today, so a dashboard cannot tell which rail observed the operation.
 */
export function toBillingTelemetryEvent(
  event: BillingOperationTelemetryEvent
): BillingTelemetryEvent {
  const terminal = {
    operation: 'operation',
    operation_type: event.operation_type,
    billing_op_id: event.billing_op_id,
    ...(event.duration_ms === undefined
      ? {}
      : { duration_ms: event.duration_ms })
  } as const

  switch (event.name) {
    case BILLING_OPERATION_TELEMETRY_EVENT.started:
      return {
        operation: 'operation',
        operation_type: event.operation_type,
        stage: 'started',
        outcome: 'pending'
      }
    case BILLING_OPERATION_TELEMETRY_EVENT.succeeded:
      return { ...terminal, stage: 'succeeded', outcome: 'success' }
    case BILLING_OPERATION_TELEMETRY_EVENT.timeout:
      return {
        ...terminal,
        stage: 'timeout',
        outcome: 'failure',
        failure_category: 'poll_timeout'
      }
    case BILLING_OPERATION_TELEMETRY_EVENT.failed:
      return {
        ...terminal,
        stage: 'failed',
        outcome: 'failure',
        failure_category: event.failure_category ?? 'provider_decline'
      }
  }
}
