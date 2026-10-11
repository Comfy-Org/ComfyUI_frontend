import type { BillingFailed } from './stages.js'

/**
 * The part of the provider's hosted portal the customer was sent to.
 * `payment_recovery` is a checkout that stopped on a failed or outstanding
 * payment and sent the customer to settle it.
 */
export type BillingPortalTarget =
  | 'payment_methods'
  | 'invoices'
  | 'manage_subscription'
  | 'payment_recovery'

/**
 * A trip to the provider's hosted portal. What the customer does there (adding,
 * removing or picking a default method, reading invoices) never reaches the
 * browser, so the trip only records leaving for the portal, failing to, and
 * coming back.
 */
export type PortalBillingEvent = {
  operation: 'portal'
  target: BillingPortalTarget
} & (
  | { stage: 'opened'; outcome: 'pending' }
  | BillingFailed
  | { stage: 'returned'; outcome: 'pending' }
)
