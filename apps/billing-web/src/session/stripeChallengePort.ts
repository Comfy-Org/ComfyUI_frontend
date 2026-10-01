/**
 * The host side of an embedded 3DS challenge: Stripe's `handleNextAction`
 * behind the `EmbeddedChallengePort` the core drives. The script loads on the
 * first challenge, not at boot, and a load that fails reports the challenge
 * failed rather than throwing into the lifecycle.
 */
import type { EmbeddedChallengePort } from '@comfyorg/account-core/billing'
import { loadStripe } from '@stripe/stripe-js/pure'

/** The one next step Stripe finishes without leaving this page. */
const IN_PAGE_NEXT_ACTION = 'use_stripe_sdk'

/**
 * `leavesPage` asks Stripe where an intent's next step runs, so a challenge
 * this page re-opens on its own never sends the customer to another site.
 * Anything Stripe cannot vouch for counts as leaving.
 */
export interface CheckoutChallengePort extends EmbeddedChallengePort {
  leavesPage: (clientSecret: string) => Promise<boolean>
}

export function createStripeChallengePort(
  publishableKey: string
): CheckoutChallengePort {
  const stripe = loadStripe(publishableKey).catch(() => null)
  return {
    handleNextAction: async (clientSecret) => {
      const provider = await stripe
      if (!provider) return { error: 'provider_unavailable' }
      try {
        return await provider.handleNextAction({ clientSecret })
      } catch (error) {
        // Stripe throws for an intent that no longer requires action, e.g. a
        // redirect payment finished before the server's status caught up.
        // The intent's own status decides whether that counts as completed.
        const { paymentIntent } =
          await provider.retrievePaymentIntent(clientSecret)
        if (paymentIntent) return { paymentIntent }
        throw error
      }
    },
    leavesPage: async (clientSecret) => {
      const provider = await stripe
      if (!provider) return true
      const { paymentIntent } =
        await provider.retrievePaymentIntent(clientSecret)
      return paymentIntent?.next_action?.type !== IN_PAGE_NEXT_ACTION
    }
  }
}

/**
 * A port whose key isn't read until a challenge actually needs it, instead of
 * at composable setup: `useCheckout` captures the port it's given once, so a
 * host that resolves the key asynchronously (the server value can arrive
 * after setup) must defer the read the same way, not resolve it early and
 * risk a build-time fallback it never gets a chance to update. No key once
 * the getter settles reports the challenge unavailable rather than silently
 * doing nothing.
 *
 * `getPublishableKey` may return a promise: a recovered operation can drive
 * its first challenge before either the build-time fallback or the server
 * key exists, and awaiting it here beats deciding on a synchronous snapshot
 * that hasn't had a chance to settle yet.
 *
 * Cached by key rather than built once: the first challenge can still run
 * before the server key arrives, and a provider pinned to the fallback key
 * would then outlive it. The key comparison and cache write happen with no
 * `await` between them, so a later call for a new key always wins the cache
 * over an earlier call's still-pending `loadStripe`.
 */
export function createDeferredStripeChallengePort(
  getPublishableKey: () => string | undefined | Promise<string | undefined>
): CheckoutChallengePort {
  let cached: { key: string; port: CheckoutChallengePort } | undefined

  async function current(): Promise<CheckoutChallengePort | undefined> {
    const publishableKey = await getPublishableKey()
    if (!publishableKey) return undefined
    if (cached?.key !== publishableKey) {
      cached = {
        key: publishableKey,
        port: createStripeChallengePort(publishableKey)
      }
    }
    return cached.port
  }

  return {
    handleNextAction: async (clientSecret) => {
      const port = await current()
      return port === undefined
        ? { error: 'provider_unavailable' }
        : port.handleNextAction(clientSecret)
    },
    leavesPage: async (clientSecret) => {
      const port = await current()
      return port === undefined ? true : port.leavesPage(clientSecret)
    }
  }
}
