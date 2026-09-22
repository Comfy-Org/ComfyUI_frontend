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
 */
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createFirebaseIdentity } from '@comfyorg/account-core/firebase'
import { fetchFirebaseConfig } from '@comfyorg/account-core/firebaseConfigSource'

import { CLOUD_BASE_URL, FIREBASE_OPTIONS } from '@/config/env'

const APP_NAME = 'billing-web'
const CONFIG_FETCH_TIMEOUT_MS = 4000

let resolution: Promise<FirebaseIdentity | undefined> | undefined

/**
 * Resolves once and is safe to call repeatedly; every caller shares the one
 * fetch and the one identity it produces. `undefined` only when neither the
 * runtime fetch nor the build-time fallback has anything to offer.
 */
export function resolveBillingWebIdentity(): Promise<
  FirebaseIdentity | undefined
> {
  resolution ??= fetchFirebaseConfig(CLOUD_BASE_URL, {
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  }).then((runtimeOptions) => {
    const options = runtimeOptions ?? FIREBASE_OPTIONS
    return options
      ? createFirebaseIdentity({ options, appName: APP_NAME })
      : undefined
  })
  return resolution
}
