import { BILLING_OPERATION_TELEMETRY_EVENT } from '../../../telemetry.js'
import type { BillingOperationTelemetryEvent } from '../operationLifecycle.js'
import type { BillingTelemetryEvent } from './billingTelemetryEvent.js'

/**
 * The lifecycle's event onto the poller's `billing.operation.*` stages, so
 * both rails count in one funnel; only this rail sets `presentation` and
 * `resumed`.
 */
export function toBillingTelemetryEvent(
  event: BillingOperationTelemetryEvent
): BillingTelemetryEvent {
  const shared = {
    operation: 'operation',
    billing_client: 'sdk',
    operation_type: event.operation_type,
    billing_op_id: event.billing_op_id,
    presentation: event.presentation,
    resumed: event.resumed,
    ...(event.duration_ms === undefined
      ? {}
      : { duration_ms: event.duration_ms })
  } as const

  switch (event.name) {
    case BILLING_OPERATION_TELEMETRY_EVENT.started:
      return { ...shared, stage: 'started', outcome: 'pending' }
    case BILLING_OPERATION_TELEMETRY_EVENT.succeeded:
      return { ...shared, stage: 'succeeded', outcome: 'success' }
    case BILLING_OPERATION_TELEMETRY_EVENT.timeout:
      return {
        ...shared,
        stage: 'timeout',
        outcome: 'failure',
        failure_category: 'poll_timeout'
      }
    case BILLING_OPERATION_TELEMETRY_EVENT.failed:
      return {
        ...shared,
        stage: 'failed',
        outcome: 'failure',
        failure_category: event.failure_category ?? 'provider_decline',
        decline_reason: event.decline_reason
      }
  }
}
