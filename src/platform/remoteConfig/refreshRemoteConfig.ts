import { api } from '@/scripts/api'

import {
  cachedTeamWorkspacesEnabled,
  remoteConfig,
  remoteConfigState
} from './remoteConfig'

// Cap the bootstrap fetch so a wedged /features endpoint can never block
// app.mount indefinitely. Same-origin GET against the local comfyui server
// should resolve in well under a second; on timeout the catch block below
// clears remoteConfig and consumers fall back to build-time defaults.
const FEATURES_FETCH_TIMEOUT_MS = 5_000

interface RefreshRemoteConfigOptions {
  /**
   * Whether to use authenticated API (default: true).
   * Set to false during bootstrap before auth is initialized.
   */
  useAuth?: boolean
}

/**
 * Loads remote configuration from the backend /features endpoint
 * and updates the reactive remoteConfig ref.
 *
 * Sets remoteConfigState to:
 * - 'anonymous' when loaded without auth
 * - 'authenticated' when loaded with auth
 * - 'error' when load fails
 */
export async function refreshRemoteConfig(
  options: RefreshRemoteConfigOptions = {}
): Promise<void> {
  const { useAuth = true } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    FEATURES_FETCH_TIMEOUT_MS
  )

  try {
    const response = useAuth
      ? await api.fetchApi('/features', {
          cache: 'no-store',
          signal: controller.signal
        })
      : await fetch('/api/features', {
          cache: 'no-store',
          signal: controller.signal
        })

    if (response.ok) {
      const config = await response.json()
      window.__CONFIG__ = config
      remoteConfig.value = config
      remoteConfigState.value = useAuth ? 'authenticated' : 'anonymous'
      if (useAuth)
        cachedTeamWorkspacesEnabled.value = Boolean(
          config.team_workspaces_enabled
        )
      return
    }

    console.warn('Failed to load remote config:', response.statusText)
    if (response.status === 401 || response.status === 403) {
      window.__CONFIG__ = {}
      remoteConfig.value = {}
      remoteConfigState.value = 'error'
    }
  } catch (error) {
    console.error('Failed to fetch remote config:', error)
    window.__CONFIG__ = {}
    remoteConfig.value = {}
    remoteConfigState.value = 'error'
  } finally {
    clearTimeout(timeoutId)
  }
}
