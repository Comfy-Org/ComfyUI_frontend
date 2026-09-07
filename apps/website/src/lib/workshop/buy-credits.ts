import type { TopUpOutcome } from '../../composables/usePrototypeTweaks'

// The MVP buys credits on a Stripe Checkout page: the amount is picked here and
// the purchase finishes on Stripe, which returns the visitor to the page they
// left. Only same-site paths go into the return address.
const CHECKOUT_ORIGIN = 'https://checkout.stripe.com'

export function stripeCheckoutHref(returnPath: string, usd: number): string {
  const url = new URL('/c/pay/comfy-workshop', CHECKOUT_ORIGIN)
  url.searchParams.set('amount', String(usd))
  if (returnPath.startsWith('/') && !returnPath.startsWith('//'))
    url.searchParams.set('success_url', returnPath)
  return url.toString()
}

// How long the prototype holds `waiting` before resolving. The real wait is a
// webhook we do not control; this only has to be long enough to read.
export const SETTLE_DELAY_MS = 1200

// Where the page settles once Stripe sends the visitor back.
export type ReturnStep = 'waiting' | 'landed' | 'unresolved'

// Completion on this rail arrives by webhook and there is no pending signal, so
// "still settling" and "the grant was lost" are the same reading: payment done,
// balance unchanged. Only elapsed time separates them, which is why the
// prototype lets you hold the page in `waiting` indefinitely.
export function returnStepFor(outcome: TopUpOutcome): ReturnStep {
  if (outcome === 'landed') return 'landed'
  if (outcome === 'unresolved') return 'unresolved'
  return 'waiting'
}
