import type {
  BillingDeclineReason,
  BillingOperationKind,
  BillingPresentation
} from '../operationState.js'

/**
 * Payment friction inside one operation: a bank challenge the customer must
 * complete, the verdict this tab saw, and each retryable decline the server
 * reports while the operation stays open. None of these settle the
 * operation, so every stage stays `pending`. A failure with a
 * `decline_reason` is the server's retryable decline; one without is this
 * tab's own challenge verdict.
 */
export type CheckoutChallengeBillingEvent = {
  operation: 'checkout'
  outcome: 'pending'
  billing_op_id: string
  operation_type: BillingOperationKind
  presentation: BillingPresentation
  /** True when this tab reattached to an operation it did not issue. */
  resumed?: boolean
} & (
  | { stage: 'challenge_required' }
  | { stage: 'challenge_completed' }
  | { stage: 'challenge_failed'; decline_reason?: BillingDeclineReason }
)
