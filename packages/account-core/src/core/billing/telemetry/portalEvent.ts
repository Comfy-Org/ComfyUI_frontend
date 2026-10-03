import type { BillingFailed } from './stages.js'

/** The part of the provider's hosted portal the customer was sent to. */
export type BillingPortalTarget =
  | 'payment_methods'
  | 'invoices'
  | 'manage_subscription'

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
