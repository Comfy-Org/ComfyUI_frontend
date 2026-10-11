import type { BillingDeclineReason } from '../operationState.js'
import type {
  BillingFailed,
  BillingRecoveredSucceeded,
  BillingStarted
} from './stages.js'
import type { PaymentIntentSource, ResubscribeSource } from './vocabulary.js'

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
