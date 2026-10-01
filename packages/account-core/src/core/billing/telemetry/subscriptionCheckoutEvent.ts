import type { SubscribeResponse } from '@comfyorg/ingest-types'

import type {
  BillingCheckoutReceived,
  BillingFailed,
  BillingIntent,
  BillingRecoveredSucceeded,
  BillingRequestSent,
  BillingStarted,
  BillingTimedOut
} from './stages.js'
import type {
  BillingCycle,
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from './vocabulary.js'

export type SubscriptionCheckoutBillingEvent = {
  operation: 'subscription_checkout'
  billing_op_id?: string
  checkout_attempt_id?: string
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (
  | BillingIntent
  | BillingCheckoutReceived<SubscribeResponse['status']>
  | BillingRequestSent
  | BillingStarted
  | BillingRecoveredSucceeded
  | BillingFailed
  | BillingTimedOut
)
