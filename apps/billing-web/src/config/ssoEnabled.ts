/**
 * The Cloud app's `sso_enabled` rollout flag, read from the anonymous
 * `/api/features` document this origin already fetches for its Firebase
 * config, so with that read done it adds no request.
 */
import { resolveSsoEnabled } from '@comfyorg/account-core/firebase'

import { CLOUD_BASE_URL } from '@/config/env'

/** Same value as `@/config/firebase`, so the flag shares its fetch. */
const CONFIG_FETCH_TIMEOUT_MS = 4000

export function readBillingWebSsoEnabled(): Promise<boolean> {
  return resolveSsoEnabled({
    cloudBaseUrl: CLOUD_BASE_URL,
    timeoutMs: CONFIG_FETCH_TIMEOUT_MS
  })
}
