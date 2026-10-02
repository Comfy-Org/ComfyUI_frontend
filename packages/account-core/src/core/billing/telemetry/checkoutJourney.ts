import type { CapabilityDenialReason } from '../capabilityDenials.js'
import type {
  BillingTelemetryErrorCode,
  BillingTelemetryFailureCategory
} from './stages.js'
import type { PaymentIntentSource } from './vocabulary.js'

/**
 * Checkout-journey lifecycle events for the embedded-checkout rollout.
 *
 * These intermediate stages are kept deliberately separate from the terminal
 * billing taxonomy above (`billing.<operation>.<stage>`): entry, preview, and
 * Payment Element observations are client observations of progress, never
 * business success/failure/timeout. They share one frozen journey context so
 * the two rollout arms can be compared on the same denominator.
 */
export const CHECKOUT_JOURNEY_SCHEMA_VERSION = 1

export type CheckoutJourneyArm = 'control' | 'treatment'
export type CheckoutAssignmentStatus = 'resolved' | 'unavailable'
export type CheckoutUiMode = 'embedded' | 'full_page' | 'hosted' | 'unknown'
export type CheckoutEntryFlow =
  | 'initial_subscription'
  | 'paid_upgrade'
  | 'topup'
  | 'other'
  | 'unknown'
export type CheckoutEntrySource =
  | 'pricing'
  | 'deep_link'
  | 'recovery'
  | 'settings_billing'
  | 'other'
  | 'unknown'
  | 'agent_paywall'
type CheckoutElementPhase = 'init' | 'mount' | 'update'
/** Which Stripe element in the shared group the observation came from. */
type CheckoutElementKind = 'payment' | 'address'
type CheckoutSubmitPhase = 'validation' | 'token_creation'

/**
 * The frozen arm assignment. A resolved assignment always carries an arm; an
 * unavailable one never does, so an unknown assignment cannot masquerade as a
 * resolved `control`. Encoded as a discriminated union so the invariant is a
 * compile-time guarantee rather than a convention.
 */
type CheckoutJourneyAssignment =
  | { assignment_status: 'resolved'; assigned_arm: CheckoutJourneyArm }
  | { assignment_status: 'unavailable'; assigned_arm?: never }

/**
 * Non-sensitive entry context frozen at journey creation and replayed on every
 * journey event.
 */
export type CheckoutJourneyContext = {
  checkout_journey_id: string
  /** UTC ISO-8601 timestamp captured at common intent, preserved across reload. */
  checkout_entered_at: string
  ui_mode?: CheckoutUiMode
  entry_flow: CheckoutEntryFlow
  entry_source: CheckoutEntrySource
  billing_op_id?: string
} & CheckoutJourneyAssignment

type CheckoutJourneyEntered = {
  phase: 'entered'
  /** The click-time entry the link carried, at the shared source grain. */
  payment_intent_source?: PaymentIntentSource
}
type CheckoutJourneyPreviewReady = {
  phase: 'preview_ready'
  preview_revision?: string
}
/** Refusals the checkout names itself, beside the codes the billing events share. */
type CheckoutPreviewErrorCode = 'quote_not_allowed' | 'plan_unavailable'
type CheckoutJourneyPreviewFailed = {
  phase: 'preview_failed'
  failure_category: BillingTelemetryFailureCategory
  error_code?: BillingTelemetryErrorCode | CheckoutPreviewErrorCode
  /** Why the capabilities read refused this checkout. */
  denial_reason?: CapabilityDenialReason
  preview_revision?: string
}
type CheckoutJourneyPaymentElementReady = {
  phase: 'payment_element_ready'
  element: CheckoutElementKind
}
type CheckoutJourneyPaymentElementFailed = {
  phase: 'payment_element_failed'
  element: CheckoutElementKind
  element_phase: CheckoutElementPhase
  error_code?: string
}
type CheckoutJourneyPaymentSubmitAttempted = {
  phase: 'payment_submit_attempted'
}
type CheckoutJourneyPaymentSubmitFailed = {
  phase: 'payment_submit_failed'
  submit_phase: CheckoutSubmitPhase
  error_code?: string
}
type CheckoutPaymentRail = 'saved' | 'new' | 'on_file'
export type CheckoutMethodKind = 'card' | 'alipay' | 'other'
type CheckoutPromoResult = 'applied' | 'rejected' | 'removed' | 'expired'
type CheckoutPayBlockedReason = 'reactivation_unconfirmed' | 'promo_unapplied'

type CheckoutJourneyMethodSelected = {
  phase: 'method_selected'
  rail: CheckoutPaymentRail
  method_kind?: CheckoutMethodKind
}
type CheckoutJourneyPromo = {
  phase: 'promo'
  result: CheckoutPromoResult
  /** Whether the entry link carried the code; the code itself is never reported. */
  prefilled: boolean
}
type CheckoutJourneyPayBlocked = {
  phase: 'pay_blocked'
  reason: CheckoutPayBlockedReason
}
type CheckoutJourneySubmitted = { phase: 'submitted' }
type CheckoutJourneyOperationLinked = {
  phase: 'operation_linked'
  billing_op_id: string
}

export type CheckoutJourneyPhaseEvent =
  | CheckoutJourneyEntered
  | CheckoutJourneyPreviewReady
  | CheckoutJourneyPreviewFailed
  | CheckoutJourneyPaymentElementReady
  | CheckoutJourneyPaymentElementFailed
  | CheckoutJourneyPaymentSubmitAttempted
  | CheckoutJourneyPaymentSubmitFailed
  | CheckoutJourneyMethodSelected
  | CheckoutJourneyPromo
  | CheckoutJourneyPayBlocked
  | CheckoutJourneySubmitted
  | CheckoutJourneyOperationLinked

type CheckoutJourneyPhase = CheckoutJourneyPhaseEvent['phase']

export type CheckoutJourneyTelemetryEvent = CheckoutJourneyContext &
  CheckoutJourneyPhaseEvent

export type CheckoutJourneyTelemetryEventName =
  `billing.checkout.${CheckoutJourneyPhase}`

/**
 * The wire name for every phase. Typed as a total `Record` over the phase
 * union, so a phase added to the union without a name here fails to compile —
 * and so the runtime list below can never drift from the emitted names.
 */
export const CHECKOUT_JOURNEY_EVENT_NAME_BY_PHASE: Record<
  CheckoutJourneyPhase,
  CheckoutJourneyTelemetryEventName
> = {
  entered: 'billing.checkout.entered',
  preview_ready: 'billing.checkout.preview_ready',
  preview_failed: 'billing.checkout.preview_failed',
  payment_element_ready: 'billing.checkout.payment_element_ready',
  payment_element_failed: 'billing.checkout.payment_element_failed',
  payment_submit_attempted: 'billing.checkout.payment_submit_attempted',
  payment_submit_failed: 'billing.checkout.payment_submit_failed',
  method_selected: 'billing.checkout.method_selected',
  promo: 'billing.checkout.promo',
  pay_blocked: 'billing.checkout.pay_blocked',
  submitted: 'billing.checkout.submitted',
  operation_linked: 'billing.checkout.operation_linked'
}

export function getCheckoutJourneyTelemetryEventName(
  event: CheckoutJourneyTelemetryEvent
): CheckoutJourneyTelemetryEventName {
  return CHECKOUT_JOURNEY_EVENT_NAME_BY_PHASE[event.phase]
}

function getContextPayload(event: CheckoutJourneyTelemetryEvent) {
  return {
    schema_version: CHECKOUT_JOURNEY_SCHEMA_VERSION,
    phase: event.phase,
    checkout_journey_id: event.checkout_journey_id,
    checkout_entered_at: event.checkout_entered_at,
    assignment_status: event.assignment_status,
    entry_flow: event.entry_flow,
    entry_source: event.entry_source,
    ...(event.assigned_arm !== undefined && {
      assigned_arm: event.assigned_arm
    }),
    ...(event.ui_mode !== undefined && { ui_mode: event.ui_mode }),
    ...(event.billing_op_id !== undefined && {
      billing_op_id: event.billing_op_id
    })
  }
}

function getPreviewPayload(event: CheckoutJourneyPhaseEvent) {
  return {
    ...('preview_revision' in event &&
      event.preview_revision !== undefined && {
        preview_revision: event.preview_revision
      }),
    ...('failure_category' in event && {
      failure_category: event.failure_category
    }),
    ...('error_code' in event &&
      event.error_code !== undefined && { error_code: event.error_code }),
    ...('denial_reason' in event &&
      event.denial_reason !== undefined && {
        denial_reason: event.denial_reason
      })
  }
}

function getPaymentFormPayload(event: CheckoutJourneyPhaseEvent) {
  return {
    ...('element' in event && { element: event.element }),
    ...('element_phase' in event && { element_phase: event.element_phase }),
    ...('submit_phase' in event && { submit_phase: event.submit_phase })
  }
}

function getChoicePayload(event: CheckoutJourneyPhaseEvent) {
  return {
    ...('payment_intent_source' in event &&
      event.payment_intent_source !== undefined && {
        payment_intent_source: event.payment_intent_source
      }),
    ...('rail' in event && { rail: event.rail }),
    ...('method_kind' in event &&
      event.method_kind !== undefined && { method_kind: event.method_kind }),
    ...('result' in event && { result: event.result }),
    ...('prefilled' in event && { prefilled: event.prefilled }),
    ...('reason' in event && { reason: event.reason })
  }
}

export function getCheckoutJourneyTelemetryEventPayload(
  event: CheckoutJourneyTelemetryEvent
) {
  return {
    ...getContextPayload(event),
    ...getPreviewPayload(event),
    ...getPaymentFormPayload(event),
    ...getChoicePayload(event)
  }
}

export type CheckoutJourneyTelemetryEventPayload = ReturnType<
  typeof getCheckoutJourneyTelemetryEventPayload
>
