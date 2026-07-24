import {
  cachedBillingControlEnabled,
  cachedConsolidatedBillingEnabled,
  cachedTeamWorkspacesEnabled,
  remoteConfig,
  remoteConfigState
} from './remoteConfig'

// Cap the bootstrap fetch so a wedged /features endpoint can never block app.mount indefinitely.
// A same-origin GET against the local comfyui server should resolve in well under a second;
// on timeout the catch below clears remoteConfig and consumers fall back to build-time defaults.
const FEATURES_FETCH_TIMEOUT_MS = 5_000

interface RefreshRemoteConfigOptions {
  /**
   * Whether to use authenticated API (default: true).
   * Set to false during bootstrap before auth is initialized.
   */
  useAuth?: boolean
}

async function fetchRemoteConfig(
  useAuth: boolean,
  signal?: AbortSignal
): Promise<Response> {
  const { api } = await import('@/scripts/api')
  if (!useAuth) {
    return fetch(api.apiURL('/features'), { cache: 'no-store', signal })
  }
  return api.fetchApi('/features', { cache: 'no-store' })
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

  const controller = useAuth ? null : new AbortController()
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), FEATURES_FETCH_TIMEOUT_MS)
    : null

  try {
    const response = await fetchRemoteConfig(useAuth, controller?.signal)

    if (response.ok) {
      const config = await response.json()
      window.__CONFIG__ = config
      remoteConfig.value = config
      remoteConfigState.value = useAuth ? 'authenticated' : 'anonymous'
      if (useAuth) {
        cachedTeamWorkspacesEnabled.value = Boolean(
          config.team_workspaces_enabled
        )
        cachedConsolidatedBillingEnabled.value = Boolean(
          config.consolidated_billing_enabled
        )
        cachedBillingControlEnabled.value = Boolean(
          config.billing_control_enabled
        )
      }
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
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}
