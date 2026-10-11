import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

/**
 * The server's `/features` value when configured, this deployment's
 * build-time fallback otherwise. `remoteConfig` already carries this
 * document — fetched once at boot — so reading it here costs no extra
 * request; a non-string or empty server value is treated as absent.
 */
export function resolveStripePublishableKey(): string | undefined {
  const fromServer = remoteConfig.value.stripe_publishable_key
  return typeof fromServer === 'string' && fromServer !== ''
    ? fromServer
    : import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
}
