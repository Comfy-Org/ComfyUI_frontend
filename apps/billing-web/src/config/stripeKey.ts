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
 * callback re-invoked at call time, such as `embeddedCheckoutAvailable`;
 * `awaitBillingWebStripeKey` is for a caller that must not decide before the
 * fetch has had a chance to settle, such as a recovered embedded challenge.
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
let resolution: Promise<void> | undefined

function ensureStarted(): void {
  if (started) return
  started = true
  resolution = resolveStripePublishableKey({
    cloudBaseUrl: CLOUD_BASE_URL,
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  }).then((serverKey) => {
    // account-core keeps its memo once the document has either field, so a
    // retry here reuses that resolved fetch rather than firing a new one; it
    // only re-fetches when account-core itself evicted the memo, i.e. the
    // document genuinely failed to load.
    if (serverKey) stripeKeyRef.value = serverKey
    else started = false
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

/**
 * Joins the in-flight resolution rather than reading a synchronous snapshot:
 * for a caller that can run before either the build-time fallback or the
 * server key exists (an embedded challenge recovered on reload), waiting out
 * the fetch beats reporting the key unavailable purely on timing.
 */
export async function awaitBillingWebStripeKey(): Promise<string | undefined> {
  ensureStarted()
  if (stripeKeyRef.value === undefined) await resolution
  return stripeKeyRef.value
}
