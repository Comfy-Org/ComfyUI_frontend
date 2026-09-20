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
