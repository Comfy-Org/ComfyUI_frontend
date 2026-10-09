import type { BillingPresentation } from '../operationState.js'
import type { BillingOperationTerminal, BillingStarted } from './stages.js'
import type {
  BillingCycle,
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from './vocabulary.js'

export type BillingOperationBillingEvent = {
  operation: 'operation'
  /** Absent when the initiating call itself failed, before the backend returned one to poll. */
  billing_op_id?: string
  operation_type: 'subscription' | 'topup' | 'cancel' | 'retention'
  /** Set by the billing SDK rail, as is `resumed`; the poller never sets either. */
  presentation?: BillingPresentation
  /** True when this tab reattached to an operation it did not issue. */
  resumed?: boolean
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event, including the
   * initiating API call's latency (not just the poll-observation window).
   * On `timeout` this is how long the client watched, not the operation's
   * true duration.
   */
  duration_ms?: number
} & (BillingStarted | BillingOperationTerminal)
