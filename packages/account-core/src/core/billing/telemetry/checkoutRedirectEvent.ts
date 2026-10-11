import type {
  BillingOperationKind,
  BillingPresentation,
  HostedBillingDestination
} from '../operationState.js'
import type { CheckoutMethodKind } from './checkoutJourney.js'

/** What the hosted page asks of the customer, from what the server waits on. */
export type CheckoutHostedStep =
  | 'authentication'
  | 'payment_method'
  | 'invoice_payment'
  | 'checkout'

/** The hosted page replaced this page, or opened beside it. */
export type CheckoutRedirectNavigation = 'redirect' | 'new_tab'

/**
 * A hosted step this tab handed the customer to, and the customer back on the
 * tab that handed it. Neither settles the operation; the pair joins on
 * `billing_op_id`, and a start with no return is a customer who did not come
 * back.
 */
export type CheckoutRedirectBillingEvent = {
  operation: 'checkout'
  outcome: 'pending'
  billing_op_id: string
  operation_type: BillingOperationKind
  presentation: BillingPresentation
  /** True when this tab reattached to an operation it did not issue. */
  resumed?: boolean
  destination: HostedBillingDestination
  step: CheckoutHostedStep
  navigation: CheckoutRedirectNavigation
  /** The method the customer chose, when the host knows it. */
  method_kind?: CheckoutMethodKind
} & ({ stage: 'redirect_started' } | { stage: 'returned' })
