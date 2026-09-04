import type { BillingFlagState } from '@/platform/telemetry/types'
import { api } from '@/scripts/api'

/**
 * The embedded-checkout flag is delivered only on the WebSocket `feature_flags`
 * handshake, and its resolver reads `false` until that map lands. Reporting
 * that `false` as `embedded_checkout_off` would file every pre-handshake
 * attempt under the ungated arm of the rollout dashboard, so a session whose
 * handshake has not been answered reports `unknown` instead.
 *
 * Keyed off the handshake itself rather than an inhabited flag map: a server
 * that advertises no flags is a legitimate ungated arm, and reading that as
 * `unknown` would empty both arms of the dashboard in a way indistinguishable
 * from no traffic.
 *
 * Resolve this once at attempt start and carry the result on the attempt's
 * later events: a reconnect can replace the flag map mid-attempt, but the
 * attempt still ran under the state it started with.
 */
export function resolveBillingFlagState(
  embeddedCheckoutEnabled: boolean
): BillingFlagState {
  if (embeddedCheckoutEnabled) return 'embedded_checkout_on'
  return api.hasReceivedServerFeatureFlags()
    ? 'embedded_checkout_off'
    : 'embedded_checkout_unknown'
}
