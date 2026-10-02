import type {
  BillingFailed,
  BillingRecoveredSucceeded,
  BillingStarted
} from './stages.js'
import type { PaymentIntentSource, ResubscribeSource } from './vocabulary.js'

export type ResubscribeBillingEvent = {
  operation: 'resubscribe'
  source: ResubscribeSource
  checkout_attempt_id?: string
  payment_intent_source?: PaymentIntentSource
} & (BillingStarted | BillingRecoveredSucceeded | BillingFailed)
