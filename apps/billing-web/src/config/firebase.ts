/**
 * This origin's Firebase identity, resolved once from the Cloud app's own
 * `/api/features`. No build-time fallback: a usable billing session only
 * ever comes from token exchange at that same Cloud origin, so an outage
 * there leaves nothing for a stale build-time project to buy, while a stale
 * config that outlives a project rotation is a real, silent failure mode.
 * Account-core owns the fetch, construction, and failure handling; this
 * origin only names the Cloud origin and its own app name.
 */
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { resolveFirebaseIdentity } from '@comfyorg/account-core/firebase'

import { CLOUD_BASE_URL } from '@/config/env'

const APP_NAME = 'billing-web'
const CONFIG_FETCH_TIMEOUT_MS = 4000

export function resolveBillingWebIdentity(): Promise<
  FirebaseIdentity | undefined
> {
  return resolveFirebaseIdentity({
    cloudBaseUrl: CLOUD_BASE_URL,
    appName: APP_NAME,
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  })
}
