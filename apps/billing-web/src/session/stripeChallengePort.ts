/**
 * The host side of an embedded 3DS challenge: Stripe's `handleNextAction`
 * behind the `EmbeddedChallengePort` the core drives. The script loads on the
 * first challenge, not at boot, and a load that fails reports the challenge
 * failed rather than throwing into the lifecycle.
 */
import type { EmbeddedChallengePort } from '@comfyorg/account-core/billing'
import { loadStripe } from '@stripe/stripe-js/pure'

export function createStripeChallengePort(
  publishableKey: string
): EmbeddedChallengePort {
  const stripe = loadStripe(publishableKey).catch(() => null)
  return {
    handleNextAction: async (clientSecret) => {
      const provider = await stripe
      if (!provider) return { error: 'provider_unavailable' }
      return provider.handleNextAction({ clientSecret })
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
): EmbeddedChallengePort {
  let cached: { key: string; port: EmbeddedChallengePort } | undefined
  return {
    handleNextAction: async (clientSecret) => {
      const publishableKey = await getPublishableKey()
      if (!publishableKey) return { error: 'provider_unavailable' }
      if (cached?.key !== publishableKey) {
        cached = {
          key: publishableKey,
          port: createStripeChallengePort(publishableKey)
        }
      }
      return cached.port.handleNextAction(clientSecret)
    }
  }
}
