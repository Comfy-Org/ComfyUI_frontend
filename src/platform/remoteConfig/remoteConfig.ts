/**
 * Remote configuration service
 *
 * Fetches configuration from the server at runtime, enabling:
 * - Feature flags without rebuilding
 * - Server-side feature discovery
 * - Version compatibility management
 * - Avoiding vendor lock-in for native apps
 *
 * This module is tree-shaken in OSS builds.
 * Used for initial config load in main.ts and polling in the extension.
 */

import { computed, ref } from 'vue'

import type { RemoteConfig } from './types'

/**
 * Reactive remote configuration
 * Updated whenever config is loaded from the server
 */
export const remoteConfig = ref<RemoteConfig>({})

/**
 * Loads remote configuration from the backend /api/features endpoint
 * and updates the reactive remoteConfig ref
 */
export async function loadRemoteConfig(): Promise<void> {
  try {
    const response = await fetch('/api/features', { cache: 'no-store' })
    if (response.ok) {
      const config = await response.json()
      window.__CONFIG__ = config
      remoteConfig.value = config
    } else {
      console.warn('Failed to load remote config:', response.statusText)
      window.__CONFIG__ = {}
      remoteConfig.value = {}
    }
  } catch (error) {
    console.error('Failed to fetch remote config:', error)
    window.__CONFIG__ = {}
    remoteConfig.value = {}
  }
}

/**
 * Returns the most recent remote configuration available to the client.
 * Prefers the reactive ref (which updates when polling) and falls back to the
 * last value stored on window.__CONFIG__ so early imports can still resolve
 * runtime configuration before the reactive store is populated.
 */
export function getRuntimeConfig(): RemoteConfig {
  if (Object.keys(remoteConfig.value).length > 0) {
    return remoteConfig.value
  }

  return window.__CONFIG__ ?? {}
}

export function useRuntimeConfig() {
  return computed<RemoteConfig>(() => {
    if (Object.keys(remoteConfig.value).length > 0) {
      return remoteConfig.value
    }

    return window.__CONFIG__ ?? {}
  })
}
