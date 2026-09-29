/**
 * This visitor's `unified_web_session`, read at most once per page load and
 * never awaited by render. The website has no anonymous `/api/features` read
 * of its own, so the probe costs one plain anonymous GET (no cookie, no custom
 * header, no preflight): the one request this adds while the rollout is off.
 */
import {
  readWebSessionProbe,
  resolveUnifiedWebSession
} from '@comfyorg/account-core/webSessionFlag'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

let resolution: Promise<boolean> | undefined

export function readUnifiedWebSessionEnabled(): Promise<boolean> {
  if (!resolution) {
    const options = {
      cloudBaseUrl: WORKSHOP_CLOUD_BASE_URL,
      fetchImpl: (...args: Parameters<typeof fetch>) =>
        globalThis.fetch(...args)
    }
    resolution = resolveUnifiedWebSession({
      ...options,
      probe: () => readWebSessionProbe(options)
    })
  }
  return resolution
}
