/**
 * The one place a billing operation is routed to the embedded challenge or
 * the hosted page. Hosts report whether they can drive an embedded challenge
 * at all; they never choose the route.
 *
 * Every rule fails toward hosted, which works on every rail and needs
 * nothing from the host but a way to open a URL.
 */
import type { BillingPresentation } from './operationState.js'
import type { BillingStatusData } from './status.js'

export interface PresentationRoutingInput {
  /** The host can drive an in-page challenge: its provider adapter and key are present. */
  readonly embeddedCheckoutAvailable: boolean
  readonly billingRail: BillingStatusData['billing_rail']
  /** A hosted continuation the command response already carried. */
  readonly hostedUrl?: string
  /** An in-page challenge the command response already carried. */
  readonly clientSecret?: string
}

export function selectBillingPresentation(
  input: PresentationRoutingInput
): BillingPresentation {
  // The backend answered with a page and no challenge: it has decided.
  if (input.hostedUrl !== undefined && input.clientSecret === undefined) {
    return 'hosted'
  }
  if (!input.embeddedCheckoutAvailable) return 'hosted'
  // Only the workspace Stripe rail exposes payment intents to the client.
  return input.billingRail === 'stripe' ? 'embedded' : 'hosted'
}
