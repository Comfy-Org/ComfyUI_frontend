import {
  authenticatedRemoteConfigState,
  cachedBillingControlEnabled,
  cachedLegacyBillingMigrationEnabled,
  cachedV1PaymentRecovery,
  remoteConfig,
  remoteConfigErrorStatus,
  remoteConfigRevision,
  remoteConfigState,
  sessionAgentGrant,
  sessionAgentGrantValidUntil
} from './remoteConfig'

// Cap the bootstrap fetch so a wedged /features endpoint can never block app.mount indefinitely.
// A same-origin GET against the local comfyui server should resolve in well under a second;
// on timeout consumers retain the last known config or use build-time defaults.
const FEATURES_FETCH_TIMEOUT_MS = 5_000
const AGENT_GRANT_FALLBACK_MS = 15 * 60_000

interface RefreshRemoteConfigOptions {
  /**
   * Whether to use authenticated API (default: true).
   * Set to false during bootstrap before auth is initialized.
   */
  useAuth?: boolean
  signal?: AbortSignal
}

let refreshGeneration = 0
let authenticatedLoadingGeneration: number | undefined
let agentGrantExpiryTimer: ReturnType<typeof setTimeout> | undefined
const activeRefreshControllers = new Set<AbortController>()

function clearSessionAgentGrant(): void {
  clearTimeout(agentGrantExpiryTimer)
  agentGrantExpiryTimer = undefined
  sessionAgentGrant.value = undefined
  sessionAgentGrantValidUntil.value = undefined
}

function cacheSessionAgentGrant(granted: boolean): void {
  clearTimeout(agentGrantExpiryTimer)
  sessionAgentGrant.value = granted
  const validUntil = Date.now() + AGENT_GRANT_FALLBACK_MS
  sessionAgentGrantValidUntil.value = validUntil
  agentGrantExpiryTimer = setTimeout(() => {
    if (sessionAgentGrantValidUntil.value !== validUntil) return
    clearSessionAgentGrant()
  }, AGENT_GRANT_FALLBACK_MS)
}

export function invalidateRemoteConfig(): void {
  refreshGeneration++
  authenticatedLoadingGeneration = undefined
  for (const controller of activeRefreshControllers) controller.abort()
  activeRefreshControllers.clear()
  const { comfy_api_base_url, comfy_cloud_base_url, comfy_platform_base_url } =
    remoteConfig.value
  const retainedConfig = {
    ...(comfy_api_base_url && { comfy_api_base_url }),
    ...(comfy_cloud_base_url && { comfy_cloud_base_url }),
    ...(comfy_platform_base_url && { comfy_platform_base_url })
  }
  window.__CONFIG__ = retainedConfig
  remoteConfig.value = retainedConfig
  remoteConfigErrorStatus.value = null
  remoteConfigState.value = 'unloaded'
  authenticatedRemoteConfigState.value = 'unloaded'
  cachedLegacyBillingMigrationEnabled.value = undefined
  clearSessionAgentGrant()
}

async function fetchRemoteConfig(
  useAuth: boolean,
  signal?: AbortSignal
): Promise<{ response: Response; authenticated: boolean }> {
  const { api } = await import('@/scripts/api')
  if (!useAuth) {
    return {
      response: await fetch(api.apiURL('/features'), {
        cache: 'no-store',
        signal
      }),
      authenticated: false
    }
  }
  let authenticated = false
  const response = await api.fetchApi('/features', {
    cache: 'no-store',
    signal,
    onAuthHeader: (attached) => {
      authenticated = attached
    }
  })
  return { response, authenticated }
}

function commitRemoteConfigSuccess(
  config: Record<string, unknown>,
  useAuth: boolean
): void {
  window.__CONFIG__ = config
  remoteConfig.value = config
  remoteConfigErrorStatus.value = null
  remoteConfigState.value = useAuth ? 'authenticated' : 'anonymous'
  if (useAuth) {
    authenticatedRemoteConfigState.value = 'authenticated'
    authenticatedLoadingGeneration = undefined
    cachedBillingControlEnabled.value = Boolean(config.billing_control_enabled)
    cachedLegacyBillingMigrationEnabled.value = Boolean(
      config.legacy_billing_migration_enabled
    )
    cachedV1PaymentRecovery.value = Boolean(config.v1_payment_recovery)
    cacheSessionAgentGrant(config['agent-in-app-experience'] === true)
  } else {
    authenticatedRemoteConfigState.value = 'unloaded'
    clearSessionAgentGrant()
  }
  remoteConfigRevision.value++
}

function commitRemoteConfigFailure(response: Response, useAuth: boolean): void {
  console.warn('Failed to load remote config:', response.statusText)
  if (response.status === 401 || response.status === 403) {
    if (useAuth) {
      remoteConfigErrorStatus.value = response.status
      window.__CONFIG__ = {}
      remoteConfig.value = {}
      clearSessionAgentGrant()
    } else {
      remoteConfigErrorStatus.value = null
    }
  } else {
    remoteConfigErrorStatus.value = null
  }
  if (useAuth) cachedLegacyBillingMigrationEnabled.value = undefined
  if (useAuth) {
    authenticatedRemoteConfigState.value = 'error'
    authenticatedLoadingGeneration = undefined
  }
  remoteConfigState.value = 'error'
  remoteConfigRevision.value++
}

function commitRemoteConfigException(error: unknown, useAuth: boolean): void {
  console.error('Failed to fetch remote config:', error)
  remoteConfigErrorStatus.value = null
  if (useAuth) cachedLegacyBillingMigrationEnabled.value = undefined
  if (useAuth) {
    authenticatedRemoteConfigState.value = 'error'
    authenticatedLoadingGeneration = undefined
  }
  remoteConfigState.value = 'error'
  remoteConfigRevision.value++
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
  const { useAuth = true, signal } = options
  const generation = ++refreshGeneration
  const previousAuthenticatedState = authenticatedRemoteConfigState.value
  if (useAuth && previousAuthenticatedState !== 'authenticated') {
    authenticatedRemoteConfigState.value = 'loading'
    authenticatedLoadingGeneration = generation
  }
  const controller = new AbortController()
  activeRefreshControllers.add(controller)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()

  const timeoutId = setTimeout(
    () => controller.abort(),
    FEATURES_FETCH_TIMEOUT_MS
  )

  try {
    const { response, authenticated } = await fetchRemoteConfig(
      useAuth,
      controller.signal
    )
    if (generation !== refreshGeneration) return
    if (signal?.aborted) return

    if (response.ok) {
      const config = await response.json()
      if (generation !== refreshGeneration) return
      if (signal?.aborted) return
      if (useAuth && !authenticated) {
        authenticatedRemoteConfigState.value = 'error'
        authenticatedLoadingGeneration = undefined
        remoteConfigErrorStatus.value = null
        remoteConfigState.value = 'error'
        console.warn(
          'Rejected authenticated remote config response without credentials'
        )
        remoteConfigRevision.value++
        return
      }
      commitRemoteConfigSuccess(config, useAuth)
      return
    }
    commitRemoteConfigFailure(response, useAuth)
  } catch (error) {
    if (generation !== refreshGeneration) return
    if (signal?.aborted) return
    commitRemoteConfigException(error, useAuth)
  } finally {
    if (authenticatedLoadingGeneration === generation) {
      authenticatedRemoteConfigState.value = previousAuthenticatedState
      authenticatedLoadingGeneration = undefined
    }
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
    activeRefreshControllers.delete(controller)
  }
}
