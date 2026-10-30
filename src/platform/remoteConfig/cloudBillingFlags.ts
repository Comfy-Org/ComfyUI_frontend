import { pick } from 'es-toolkit'

import {
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'

import { remoteConfig, remoteConfigRevision } from './remoteConfig'
import type { RemoteConfig } from './types'

/** The billing keys a local build reads from Cloud; the local server serves none of them. */
const CLOUD_BILLING_FLAG_KEYS = [
  'unified_billing_settings',
  'hosted_billing_destination',
  'billing_web_url'
] as const satisfies readonly (keyof RemoteConfig)[]

let generation = 0

function commit(config: RemoteConfig): void {
  remoteConfig.value = config
  remoteConfigRevision.value++
}

function withoutCloudBillingFlags(config: RemoteConfig): RemoteConfig {
  const rest = { ...config }
  for (const key of CLOUD_BILLING_FLAG_KEYS) delete rest[key]
  return rest
}

/**
 * Merges the signed-in user's Cloud billing flags into the local config.
 * A failed read leaves them unset, so billing stays on the provider rail.
 */
export async function refreshCloudBillingFlags(): Promise<void> {
  const requested = ++generation
  try {
    const { data } = await ingestApiClient.get<RemoteConfig>(
      ingestApiUrl('/features'),
      await requestAuth()
    )
    if (requested !== generation) return
    commit({
      ...withoutCloudBillingFlags(remoteConfig.value),
      ...pick(data, CLOUD_BILLING_FLAG_KEYS)
    })
  } catch (error) {
    if (requested !== generation) return
    console.warn('Failed to load Cloud billing flags:', error)
    clearCloudBillingFlags()
  }
}

export function clearCloudBillingFlags(): void {
  generation++
  commit(withoutCloudBillingFlags(remoteConfig.value))
}
