import type { BillingDeclineReason } from '#/core/billing/operationState'
import type {
  BillingFailed,
  BillingRecoveredSucceeded,
  BillingStarted
} from './stages'
import type { PaymentIntentSource, ResubscribeSource } from './vocabulary'

export type ResubscribeBillingEvent = {
  operation: 'resubscribe'
  source: ResubscribeSource
  billing_op_id?: string
  checkout_attempt_id?: string
  payment_intent_source?: PaymentIntentSource
  duration_ms?: number
} & (
  | BillingStarted
  | BillingRecoveredSucceeded
  | (BillingFailed & { decline_reason?: BillingDeclineReason })
)
