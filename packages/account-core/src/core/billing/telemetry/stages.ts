import type { BillingDeclineReason } from '../operationState.js'

export type BillingTelemetryFailureCategory =
  | 'validation'
  | 'network'
  | 'api_rejected'
  | 'provider_decline'
  | 'redirect'
  | 'poll_timeout'
  | 'reconciliation_needed'
  | 'stale_operation'
  | 'rendering'
  | 'unknown'

export type BillingTelemetryErrorCode =
  | 'conflicting_payment_method'
  | 'downgrade_not_allowed'
  | 'invalid_request'
  | 'member_removal_failed'
  | 'missing_checkout_response'
  | 'missing_payment_method_url'
  | 'operation_already_pending'
  | 'payment_popup_blocked'
  | 'quote_stale'
  | 'reactivation_not_confirmed'
  | 'reactivation_amount_changed'

export interface BillingTelemetryFailure {
  failure_category: BillingTelemetryFailureCategory
  error_code?: BillingTelemetryErrorCode
}

export type BillingIntent = {
  stage: 'intent'
  outcome: 'pending'
}

export type BillingRequestSent = {
  stage: 'request_sent'
  outcome: 'pending'
}

export type BillingCheckoutReceived<Status extends string> = {
  stage: 'checkout_received'
  outcome: 'pending'
  billing_op_id: string
  checkout_status: Status
}

export type BillingStarted = {
  stage: 'started'
  outcome: 'pending'
}

export type BillingSucceeded = {
  stage: 'succeeded'
  outcome: 'success'
}

export type BillingRecoveredSucceeded = BillingSucceeded & {
  recovery_outcome?: 'late_success'
}

export type BillingFailed = BillingTelemetryFailure & {
  stage: 'failed'
  outcome: 'failure'
}

export type BillingTimedOut = {
  stage: 'timeout'
  outcome: 'failure'
  failure_category: 'poll_timeout'
}

/** The stage one attempt at a billing operation settled on. */
export type BillingOperationTerminal =
  | BillingSucceeded
  | (BillingFailed & { decline_reason?: BillingDeclineReason })
  | BillingTimedOut
