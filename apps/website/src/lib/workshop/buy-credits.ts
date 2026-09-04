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
