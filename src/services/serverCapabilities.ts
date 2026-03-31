import { get } from 'es-toolkit/compat'

import { getApiBase } from '@/platform/distribution/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const EMPTY: Readonly<Record<string, unknown>> = Object.freeze({})
const MAX_RETRIES = 2

let capabilities: Readonly<Record<string, unknown>> = EMPTY

export async function initServerCapabilities(): Promise<void> {
  const url = `${getApiBase()}/api/features`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        capabilities = Object.freeze(await res.json())
        return
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(
          '[serverCapabilities] Invalid JSON response, skipping retries'
        )
        break
      }
    }
  }

  console.warn('Failed to fetch server capabilities after retries')
  capabilities = EMPTY
}

/**
 * Override a single capability at runtime.
 * Used by E2E tests to enable features not returned by the CI backend.
 */
export function setServerCapability(key: string, value: unknown): void {
  capabilities = Object.freeze({ ...capabilities, [key]: value })
}

export function getServerCapability<T = unknown>(
  key: string,
  defaultValue?: T
): T {
  const override = getDevOverride<T>(key)
  if (override !== undefined) return override
  return get(capabilities, key, defaultValue) as T
}
