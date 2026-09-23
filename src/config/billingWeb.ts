import type { HostedBillingDestination } from '@comfyorg/account-core/billing'

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

export function getBillingWebUrl(): URL | null {
  const value = import.meta.env.VITE_BILLING_WEB_URL
  if (!value) return null

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
