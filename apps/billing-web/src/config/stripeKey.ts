/**
 * This origin's Stripe publishable key: the Cloud app's own `/api/features`
 * value once account-core's shared fetch resolves, this deployment's
 * build-time fallback until then and whenever the server has none
 * configured. `VITE_STRIPE_PUBLISHABLE_KEY` stays a fallback only until the
 * server always sends the field; once it does, drop it.
 *
 * Kept as a `ref`, the same way `resolveBillingWebIdentity` bridges its own
 * async config fetch: a reader that captures a plain value at setup would
 * keep whatever it saw at that moment forever, never seeing a server key
 * that arrives afterward. `useBillingWebStripeKey` is for a reader that
 * needs to react to that; `billingWebStripeKey` is a plain snapshot for a
 * callback re-invoked at call time, such as `embeddedCheckoutAvailable`.
 *
 * Reads account-core's fetch directly rather than through a host-side
 * single-flight of its own: `resolveFirebaseIdentity` (`@/config/firebase`)
 * already fetches `/api/features` for this same `cloudBaseUrl`/`timeoutMs`
 * pair, and account-core dedupes by that pair, so this origin still fetches
 * the document once, not once per field.
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import { resolveStripePublishableKey } from '@comfyorg/account-core/firebase'

import { CLOUD_BASE_URL, STRIPE_PUBLISHABLE_KEY } from '@/config/env'

const CONFIG_FETCH_TIMEOUT_MS = 4000

const stripeKeyRef: Ref<string | undefined> = ref(STRIPE_PUBLISHABLE_KEY)
let started = false

function ensureStarted(): void {
  if (started) return
  started = true
  void resolveStripePublishableKey({
    cloudBaseUrl: CLOUD_BASE_URL,
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  }).then((serverKey) => {
    if (serverKey) stripeKeyRef.value = serverKey
  })
}

/** Reactive: reflects the server key once it arrives, the fallback until then. */
export function useBillingWebStripeKey(): Ref<string | undefined> {
  ensureStarted()
  return stripeKeyRef
}

/** A plain snapshot, for a callback re-invoked at call time rather than a template. */
export function billingWebStripeKey(): string | undefined {
  ensureStarted()
  return stripeKeyRef.value
}
