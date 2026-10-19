import type { BillingFailed, BillingIntent } from './stages.js'
import type { BillingCycle, SubscriptionCheckoutTier } from './vocabulary.js'

type CancelAbandoned = {
  stage: 'abandoned'
  outcome: 'pending'
}

/**
 * The customer's journey through a cancel flow, on any surface. The cancel
 * request itself is `operation` events with `operation_type: 'cancel'`, so a
 * flow ends in exactly one of those terminals, `abandoned`, or `failed` for a
 * refusal before any operation exists.
 */
export type CancelBillingEvent = {
  operation: 'cancel'
  /** The plan being cancelled; absent when unknown. */
  current_tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
} & (BillingIntent | CancelAbandoned | BillingFailed)
