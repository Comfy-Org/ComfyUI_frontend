import type {
  PaymentIntentSource,
  SubscriptionCheckoutTier
} from './vocabulary.js'

/**
 * A cloud entry point that leads to billing. A client journey observation: it
 * has no backend operation counterpart and never claims an operation outcome.
 */
export type EntryBillingEvent = {
  operation: 'entry'
  outcome: 'pending'
  payment_intent_source?: PaymentIntentSource
} & (
  | {
      stage: 'paywall_shown'
      /** The plan the customer is on when the paywall opens; absent when unknown. */
      current_tier?: SubscriptionCheckoutTier
    }
  | { stage: 'add_credits_clicked' }
)
