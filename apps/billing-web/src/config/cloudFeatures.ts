/**
 * This origin's one fetch of the Cloud app's `/api/features`, shared by
 * every reader that needs a field from it: the Firebase identity, the
 * Stripe publishable key. Memoized so the document is fetched once per page
 * load no matter how many readers ask for it.
 */
import type { CloudFeatures } from '@comfyorg/account-core/firebaseConfigSource'
import { fetchCloudFeatures } from '@comfyorg/account-core/firebaseConfigSource'

import { CLOUD_BASE_URL } from '@/config/env'

const CONFIG_FETCH_TIMEOUT_MS = 4000

let resolution: Promise<CloudFeatures> | undefined

export function resolveBillingWebFeatures(): Promise<CloudFeatures> {
  resolution ??= fetchCloudFeatures(CLOUD_BASE_URL, {
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  })
  return resolution
}
