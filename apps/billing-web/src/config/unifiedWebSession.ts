/**
 * This visitor's `unified_web_session`, read once per page load. The probe
 * comes from the `/api/features` document this origin already fetches for
 * its Firebase config, so with the probe off this adds no request at all.
 */
import { resolveWebSessionProbe } from '@comfyorg/account-core/firebase'
import { resolveUnifiedWebSession } from '@comfyorg/account-core/webSessionFlag'

import { CLOUD_BASE_URL } from '@/config/env'

/** Same value as `@/config/firebase`, so the probe shares its fetch. */
const CONFIG_FETCH_TIMEOUT_MS = 4000

let resolution: Promise<boolean> | undefined

export function readBillingWebUnifiedWebSession(): Promise<boolean> {
  resolution ??= resolveUnifiedWebSession({
    cloudBaseUrl: CLOUD_BASE_URL,
    fetchImpl: (...args) => globalThis.fetch(...args),
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS,
    probe: () =>
      resolveWebSessionProbe({
        cloudBaseUrl: CLOUD_BASE_URL,
        timeoutMs: CONFIG_FETCH_TIMEOUT_MS
      })
  })
  return resolution
}
