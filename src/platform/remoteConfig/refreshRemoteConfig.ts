import { delay } from 'es-toolkit'

import { resolveUnifiedWebSession } from '@comfyorg/account-core/webSessionFlag'

import { hasServerFirebaseConfig } from '@/config/firebase'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { isLoopbackHost } from '@/utils/hostWhitelist'

import { useRemoteConfigStore } from './remoteConfigStore'

// Cap the bootstrap fetch so a wedged /features endpoint can never block app.mount indefinitely.
// A same-origin GET against the local comfyui server should resolve in well under a second;
// on timeout consumers retain the last known config or use build-time defaults.
const FEATURES_FETCH_TIMEOUT_MS = 5_000

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
const activeRefreshControllers = new Set<AbortController>()

export function invalidateRemoteConfig(): void {
  refreshGeneration++
  authenticatedLoadingGeneration = undefined
  for (const controller of activeRefreshControllers) controller.abort()
  activeRefreshControllers.clear()
  useRemoteConfigStore().invalidate()
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

/**
 * The anonymous document answers `unified_web_session` false for a cookie-only
 * caller; only a credentialed read that names its client is authoritative.
 */
async function readCredentialedWebSessionFlag(
  config: Record<string, unknown>,
  generation: number
): Promise<void> {
  if (!isCloud || config.web_session_probe !== true) return
  const enabled = await resolveUnifiedWebSession({
    cloudBaseUrl: window.location.origin,
    fetchImpl: (...args) => fetch(...args),
    probe: async () => true
  })
  if (generation !== refreshGeneration) return
  useRemoteConfigStore().acceptUnifiedWebSession(enabled)
}

/** Loads `/features` into the remote config store, anonymously or with auth. */
export async function refreshRemoteConfig(
  options: RefreshRemoteConfigOptions = {}
): Promise<void> {
  const { useAuth = true, signal } = options
  const generation = ++refreshGeneration
  const store = useRemoteConfigStore()
  const previousAuthenticatedState = store.authenticatedLoadState
  if (useAuth && previousAuthenticatedState !== 'authenticated') {
    store.beginAuthenticatedLoad()
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
        console.warn(
          'Rejected authenticated remote config response without credentials'
        )
        authenticatedLoadingGeneration = undefined
        store.failLoad(true)
        return
      }
      authenticatedLoadingGeneration = undefined
      store.acceptConfig(config, useAuth)
      if (!useAuth) await readCredentialedWebSessionFlag(config, generation)
      return
    }
    console.warn('Failed to load remote config:', response.statusText)
    if (useAuth) authenticatedLoadingGeneration = undefined
    store.failLoad(useAuth, response.status)
  } catch (error) {
    if (generation !== refreshGeneration) return
    if (signal?.aborted) return
    console.error('Failed to fetch remote config:', error)
    if (useAuth) authenticatedLoadingGeneration = undefined
    store.failLoad(useAuth)
  } finally {
    if (authenticatedLoadingGeneration === generation) {
      store.abandonAuthenticatedLoad(previousAuthenticatedState)
      authenticatedLoadingGeneration = undefined
    }
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
    activeRefreshControllers.delete(controller)
  }
}

const BOOTSTRAP_RETRY_BASE_MS = 1_000
const BOOTSTRAP_RETRY_MAX_MS = 10_000
const BOOTSTRAP_UNNAMED_PROJECT_READS = 1

function servesLocalCloud(): boolean {
  return isLoopbackHost(window.location.hostname)
}

/**
 * Blocks until the server names the Firebase project; a loopback harness,
 * whose server never sends one, stops after a further read instead.
 */
export async function loadRemoteConfigUntilReady(): Promise<void> {
  let unnamedProjectReads = 0
  for (let attempt = 0; ; attempt++) {
    await refreshRemoteConfig({ useAuth: false })
    if (useRemoteConfigStore().loadState !== 'error') {
      if (hasServerFirebaseConfig()) return
      unnamedProjectReads++
      if (unnamedProjectReads === 1) {
        reportError(
          new Error(
            'Startup read answered without naming the Firebase project'
          ),
          {
            surface: 'workspace',
            errorType: 'startup_remote_config_without_firebase_project',
            level: 'warning',
            context: { localCloud: servesLocalCloud() }
          }
        )
      }
      if (
        servesLocalCloud() &&
        unnamedProjectReads > BOOTSTRAP_UNNAMED_PROJECT_READS
      )
        return
    }
    await delay(
      Math.min(BOOTSTRAP_RETRY_BASE_MS * 2 ** attempt, BOOTSTRAP_RETRY_MAX_MS)
    )
  }
}
