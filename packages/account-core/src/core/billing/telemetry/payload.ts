import type {
  BillingSurface,
  BillingTelemetryEvent
} from './billingTelemetryEvent.js'

type BillingTelemetryPayload = Record<string, unknown>

type KeysOfUnion<T> = T extends unknown ? keyof T : never

export type BillingPayloadFieldHandling<Event = BillingTelemetryEvent> = Record<
  Exclude<KeysOfUnion<Event>, 'operation' | 'stage' | 'outcome'>,
  'optional' | 'required'
>

export const BILLING_PAYLOAD_FIELD_HANDLING = {
  checkout_status: 'required',
  code: 'required',
  control: 'required',
  correlation_id: 'required',
  failure_category: 'required',
  has_plan: 'required',
  intent: 'required',
  member_removal_count: 'required',
  member_removal_failures: 'required',
  mode: 'required',
  operation_type: 'required',
  origin: 'required',
  product: 'required',
  reason: 'required',
  result: 'required',
  source: 'required',
  to: 'required',
  billing_client: 'optional',
  billing_op_id: 'optional',
  checkout_attempt_id: 'optional',
  checkout_type: 'optional',
  cycle: 'optional',
  decline_reason: 'optional',
  duration_ms: 'optional',
  error_code: 'optional',
  payment_intent_source: 'optional',
  presentation: 'optional',
  recovery_outcome: 'optional',
  resumed: 'optional',
  target_tier: 'optional',
  tier: 'optional'
} as const satisfies BillingPayloadFieldHandling

const OPTIONAL_BILLING_PAYLOAD_FIELDS = Object.entries(
  BILLING_PAYLOAD_FIELD_HANDLING
).flatMap(([field, handling]) => (handling === 'optional' ? [field] : []))

const REQUIRED_BILLING_PAYLOAD_FIELDS = Object.entries(
  BILLING_PAYLOAD_FIELD_HANDLING
).flatMap(([field, handling]) => (handling === 'required' ? [field] : []))

const optionalBillingPayloadFields: ReadonlySet<string> = new Set(
  OPTIONAL_BILLING_PAYLOAD_FIELDS
)
const requiredBillingPayloadFields: ReadonlySet<string> = new Set(
  REQUIRED_BILLING_PAYLOAD_FIELDS
)

export function getBillingTelemetryEventPayload(event: BillingTelemetryEvent) {
  const payload: BillingTelemetryPayload = {
    operation: event.operation,
    stage: event.stage,
    outcome: event.outcome
  }

  for (const [field, value] of Object.entries(event)) {
    if (requiredBillingPayloadFields.has(field)) {
      payload[field] = value
    } else if (optionalBillingPayloadFields.has(field) && value !== undefined) {
      payload[field] = value
    }
  }

  return payload
}

/** Only the cloud build registers the sinks that call this; the desktop host sink claims no surface. */
export function getCloudAppBillingTelemetryEventPayload(
  event: BillingTelemetryEvent
): BillingTelemetryPayload & { billing_surface: BillingSurface } {
  return {
    ...getBillingTelemetryEventPayload(event),
    billing_surface: 'cloud_app'
  }
}

/** The payload billing web reports: the same allowlist, claiming the billing web surface. */
export function getBillingWebTelemetryEventPayload(
  event: BillingTelemetryEvent
): BillingTelemetryPayload & { billing_surface: BillingSurface } {
  return {
    ...getBillingTelemetryEventPayload(event),
    billing_surface: 'billing_web'
  }
}
