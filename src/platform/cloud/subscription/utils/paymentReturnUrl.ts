/**
 * Stripe appends these on the return leg. Stripped before the router is
 * created, and dropped by anything that writes the router's query, so the
 * client secret never returns to the address bar.
 */
export const STRIPE_RETURN_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'redirect_status'
] as const

/**
 * billing-web appends these when it sends the customer back by URL. The app
 * refreshes billing on return either way, so they are only address-bar
 * noise once the page has loaded.
 */
export const BILLING_WEB_RETURN_PARAMS = [
  'billing_result',
  'billing_ref'
] as const

export function stripPaymentReturnParams(): void {
  const url = new URL(globalThis.location.href)
  const returnParams = [
    ...STRIPE_RETURN_PARAMS,
    ...BILLING_WEB_RETURN_PARAMS
  ].filter((param) => url.searchParams.has(param))
  if (returnParams.length === 0) return

  for (const param of returnParams) url.searchParams.delete(param)
  globalThis.history.replaceState(globalThis.history.state, '', url)
}
