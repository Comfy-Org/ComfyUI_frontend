/**
 * This origin's Stripe publishable key: the Cloud app's own `/api/features`
 * value once the shared fetch (`resolveBillingWebFeatures`) settles, this
 * deployment's build-time fallback until then and whenever the server has
 * none configured.
 *
 * Every reader of this key — `embeddedCheckoutAvailable`, the challenge-port
 * constructors in the checkout views — is synchronous, so this resolves the
 * same way `resolveBillingWebIdentity` bridges the async config fetch:
 * update a module-level value in place once the fetch settles, and answer
 * every read from it. A read before the fetch settles gets the build-time
 * fallback, which is today's behaviour and correct while no host serves the
 * field; a read after gets the server's value.
 */
import { resolveBillingWebFeatures } from '@/config/cloudFeatures'
import { STRIPE_PUBLISHABLE_KEY } from '@/config/env'

let resolvedKey = STRIPE_PUBLISHABLE_KEY
let started = false

export function billingWebStripeKey(): string | undefined {
  if (!started) {
    started = true
    void resolveBillingWebFeatures().then(({ stripePublishableKey }) => {
      if (stripePublishableKey) resolvedKey = stripePublishableKey
    })
  }
  return resolvedKey
}
