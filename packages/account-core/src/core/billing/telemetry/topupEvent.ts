import type { CreateTopupResponse } from '@comfyorg/ingest-types'

import type {
  BillingCheckoutReceived,
  BillingFailed,
  BillingIntent,
  BillingRequestSent,
  BillingStarted,
  BillingSucceeded
} from './stages.js'
import type { PaymentIntentSource } from './vocabulary.js'

export type TopupBillingEvent = {
  operation: 'topup'
  billing_op_id?: string
  /**
   * Surface the top-up was opened from. Absent when the caller named none,
   * exactly as on the subscription rail's events — absent is no claim, never
   * an implied default. Named `payment_intent_source` to match its siblings
   * above; the journey's own `entry_source` is a separate, smaller enum.
   */
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (
  | BillingIntent
  | BillingCheckoutReceived<CreateTopupResponse['status']>
  | BillingRequestSent
  | BillingStarted
  | BillingSucceeded
  | BillingFailed
)
