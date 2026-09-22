/**
 * This origin's Firebase identity, resolved once: the Cloud app's own
 * `/api/features` configuration when the bounded fetch returns one, this
 * deployment's build-time fallback otherwise. Nothing here touches the
 * Firebase SDK until a caller awaits the resolved identity, so a deployment
 * with neither source still boots and offers the sign-in page in its
 * unavailable state rather than failing at import.
 *
 * The fallback exists because this origin's own outage tolerance must not
 * depend on the Cloud app being up: a Cloud outage should not also take down
 * billing-web's sign-in screen.
 *
 * The runtime fetch behind this module is shared: `resolveBillingWebFeatures`
 * also carries the Stripe publishable key `@/config/stripeKey` reads, so this
 * origin fetches `/api/features` once, not once per field.
 */
import type { FirebaseOptions } from 'firebase/app'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createFirebaseIdentity } from '@comfyorg/account-core/firebase'

import { resolveBillingWebFeatures } from '@/config/cloudFeatures'
import { FIREBASE_OPTIONS } from '@/config/env'

const RUNTIME_APP_NAME = 'billing-web-runtime'
const FALLBACK_APP_NAME = 'billing-web-fallback'

let resolution: Promise<FirebaseIdentity | undefined> | undefined

/**
 * Structurally valid options can still fail the SDK's own checks (a bad key,
 * an app-name collision with a different project), and that only surfaces
 * once `initialize()` forces the app/Auth resolution eagerly, here, instead
 * of leaving it to whichever caller first touches the identity.
 *
 * The runtime and fallback candidates get distinct app names so a runtime
 * app that registers successfully but then fails `initialize()` can't shadow
 * the fallback retry: reusing one name would leave the failed app registered
 * under it, and the fallback's `assertSameProject` check would then reject a
 * build-time config that (by design) targets a different project.
 */
function tryCreateIdentity(
  options: FirebaseOptions,
  appName: string
): FirebaseIdentity | undefined {
  try {
    const identity = createFirebaseIdentity({ options, appName })
    identity.initialize()
    return identity
  } catch {
    return undefined
  }
}

/**
 * Resolves once and is safe to call repeatedly; every caller shares the one
 * fetch and the one identity it produces. `undefined` only when neither
 * source yields a working identity, never a rejection, so a bad runtime or
 * build-time config degrades to signed-out instead of stranding the session
 * in `pending` forever.
 */
export function resolveBillingWebIdentity(): Promise<
  FirebaseIdentity | undefined
> {
  resolution ??= resolveBillingWebFeatures().then(({ firebaseConfig }) => {
    const runtimeIdentity =
      firebaseConfig && tryCreateIdentity(firebaseConfig, RUNTIME_APP_NAME)
    return (
      runtimeIdentity ??
      (FIREBASE_OPTIONS &&
        tryCreateIdentity(FIREBASE_OPTIONS, FALLBACK_APP_NAME))
    )
  })
  return resolution
}
