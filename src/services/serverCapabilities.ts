import { get } from 'es-toolkit/compat'

import { isCloud } from '@/platform/distribution/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const EMPTY: Readonly<Record<string, unknown>> = Object.freeze({})
const MAX_RETRIES = 2

let capabilities: Readonly<Record<string, unknown>> = EMPTY

function getApiBase(): string {
  return isCloud ? '' : location.pathname.split('/').slice(0, -1).join('/')
}

export async function initServerCapabilities(): Promise<void> {
  const url = `${getApiBase()}/api/features`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        capabilities = Object.freeze(await res.json())
        return
      }
    } catch {
      // Retry on network errors
    }
  }

  console.warn('Failed to fetch server capabilities after retries')
  capabilities = EMPTY
}

export function getServerCapability<T = unknown>(
  key: string,
  defaultValue?: T
): T {
  const override = getDevOverride<T>(key)
  if (override !== undefined) return override
  return get(capabilities, key, defaultValue) as T
}
