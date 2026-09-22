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
 * risk a build-time fallback it never gets a chance to update. No key at
 * call time reports the challenge unavailable rather than silently doing
 * nothing.
 */
export function createDeferredStripeChallengePort(
  getPublishableKey: () => string | undefined
): EmbeddedChallengePort {
  let resolved: EmbeddedChallengePort | undefined
  return {
    handleNextAction: async (clientSecret) => {
      const publishableKey = getPublishableKey()
      if (!publishableKey) return { error: 'provider_unavailable' }
      resolved ??= createStripeChallengePort(publishableKey)
      return resolved.handleNextAction(clientSecret)
    }
  }
}
