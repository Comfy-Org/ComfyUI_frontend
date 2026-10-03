import type { HostedBillingDestination } from '@comfyorg/account-core/billing'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/** The SDK owns the vocabulary; the server resolves it per user through the `hosted_billing_destination` flag. */
export type { HostedBillingDestination }

/**
 * The single narrowing boundary for the raw wire value. Anything but the
 * exact `billing_web` variant (absent, a typo, a boolean coerced by an
 * override) stays on the provider page, so a bad read can never send a
 * customer to an origin that is not serving yet.
 */
export function normalizeHostedBillingDestination(
  value: unknown
): HostedBillingDestination {
  return value === 'billing_web' ? 'billing_web' : 'stripe'
}

function validateBillingWebUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (url.protocol === 'https:') return url

    if (
      import.meta.env.DEV &&
      url.protocol === 'http:' &&
      LOCAL_HOSTNAMES.has(url.hostname)
    ) {
      return url
    }
  } catch {
    return null
  }

  return null
}

/**
 * The server-provided origin (`/api/features`' `billing_web_url`, one per
 * environment) takes precedence; `VITE_BILLING_WEB_URL` only fills in when
 * the server sends nothing, which is how local dev points itself at a
 * `pnpm dev:cloud:billing-web` instance.
 *
 * A server value that fails validation does *not* fall through to the env
 * var: the env fallback exists for local dev against a backend that has no
 * billing-web origin configured at all, not for a real deployment that sent
 * a broken one. Silently substituting a build-time default for a live
 * backend's malformed answer would route a real customer to whatever origin
 * happens to be baked into that build. Failing closed to the provider page
 * is the safer read, and it matches the fail-closed posture the rest of the
 * hosted-billing rollout already takes for an unresolved destination.
 */
export function getBillingWebUrl(): URL | null {
  const fromServer = remoteConfig.value.billing_web_url
  if (typeof fromServer === 'string' && fromServer !== '') {
    return validateBillingWebUrl(fromServer)
  }

  const fromEnv = import.meta.env.VITE_BILLING_WEB_URL
  return fromEnv ? validateBillingWebUrl(fromEnv) : null
}
