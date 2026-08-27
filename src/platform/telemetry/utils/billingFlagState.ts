import type { BillingFlagState } from '@/platform/telemetry/types'
import { api } from '@/scripts/api'

/**
 * The embedded-checkout flag is delivered only on the WebSocket `feature_flags`
 * handshake, and its resolver reads `false` until that map lands. Reporting
 * that `false` as `embedded_checkout_off` would file every pre-handshake
 * attempt under the ungated arm of the rollout dashboard, so a session that has
 * seen no flag map at all reports `unknown` instead.
 *
 * Resolve this once at attempt start and carry the result on the attempt's
 * later events: a reconnect can replace the flag map mid-attempt, but the
 * attempt still ran under the state it started with.
 */
export function resolveBillingFlagState(
  embeddedCheckoutEnabled: boolean
): BillingFlagState {
  if (embeddedCheckoutEnabled) return 'embedded_checkout_on'
  return Object.keys(api.getServerFeatures()).length > 0
    ? 'embedded_checkout_off'
    : 'embedded_checkout_unknown'
}
