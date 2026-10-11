import type { SubscribeResponse } from '@comfyorg/ingest-types'

import type { BillingDeclineReason } from '../operationState.js'
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

/** The two checkouts billing web serves; the cloud app's events name neither. */
export type SubscriptionCheckoutUi = 'embedded' | 'full_page'

export type SubscriptionCheckoutBillingEvent = {
  operation: 'subscription_checkout'
  billing_op_id?: string
  checkout_attempt_id?: string
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  checkout_ui?: SubscriptionCheckoutUi
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
  | (BillingFailed & { decline_reason?: BillingDeclineReason })
  | BillingTimedOut
)
