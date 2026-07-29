import {
  cachedBillingControlEnabled,
  cachedConsolidatedBillingEnabled,
  cachedTeamWorkspacesEnabled,
  remoteConfig,
  remoteConfigState
} from './remoteConfig'

const FEATURES_FETCH_TIMEOUT_MS = 5_000

type RefreshRemoteConfigOptions =
  | {
      useAuth: false
    }
  | {
      useAuth?: true
      getSessionId: () => string | null
    }

async function fetchRemoteConfig(
  useAuth: boolean,
  signal?: AbortSignal
): Promise<Response> {
  const { api } = await import('@/scripts/api')
  if (!useAuth) {
    return fetch(api.apiURL('/features'), { cache: 'no-store', signal })
  }
  return api.fetchApi('/features', { cache: 'no-store', signal })
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
async function performRefreshRemoteConfig(
  useAuth: boolean,
  sessionId?: string | null,
  getSessionId?: () => string | null
): Promise<void> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    FEATURES_FETCH_TIMEOUT_MS
  )
  const sessionIsCurrent = () => !useAuth || getSessionId?.() === sessionId

  try {
    const response = await fetchRemoteConfig(useAuth, controller.signal)
    if (!sessionIsCurrent()) return

    if (response.ok) {
      const config = await response.json()
      if (!sessionIsCurrent()) return

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
      return
    }

    const safeConfig = { ...remoteConfig.value }
    delete safeConfig.release_flags
    window.__CONFIG__ = safeConfig
    remoteConfig.value = safeConfig
    remoteConfigState.value = 'error'
  } catch (error) {
    if (!sessionIsCurrent()) return

    console.error('Failed to fetch remote config:', error)
    window.__CONFIG__ = {}
    remoteConfig.value = {}
    remoteConfigState.value = 'error'
  } finally {
    clearTimeout(timeoutId)
  }
}

interface AuthenticatedRefresh {
  sessionId: string | null
  token: object
  promise: Promise<void>
}

let authenticatedRefresh: AuthenticatedRefresh | null = null

export function refreshRemoteConfig(
  options: RefreshRemoteConfigOptions
): Promise<void> {
  const useAuth = options.useAuth !== false
  if (!useAuth) return performRefreshRemoteConfig(false)
  const { getSessionId } = options
  const sessionId = getSessionId()
  if (authenticatedRefresh?.sessionId === sessionId) {
    return authenticatedRefresh.promise
  }

  const token = {}
  const promise = performRefreshRemoteConfig(
    true,
    sessionId,
    getSessionId
  ).finally(() => {
    if (authenticatedRefresh?.token === token) {
      authenticatedRefresh = null
    }
  })
  authenticatedRefresh = { sessionId, token, promise }
  return promise
}
