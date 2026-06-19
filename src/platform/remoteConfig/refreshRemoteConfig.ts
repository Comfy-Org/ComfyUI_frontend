import { remoteConfig, remoteConfigState } from './remoteConfig'

interface RefreshRemoteConfigOptions {
  /**
   * Whether to use authenticated API (default: true).
   * Set to false during bootstrap before auth is initialized.
   */
  useAuth?: boolean
}

async function fetchRemoteConfig(useAuth: boolean): Promise<Response> {
  if (!useAuth) return fetch('/api/features', { cache: 'no-store' })

  const { api } = await import('@/scripts/api')
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

  try {
    const response = await fetchRemoteConfig(useAuth)

    if (response.ok) {
      const config = await response.json()
      window.__CONFIG__ = config
      remoteConfig.value = config
      remoteConfigState.value = useAuth ? 'authenticated' : 'anonymous'
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
  }
}
