import { api } from '@/scripts/api'

import { remoteConfig } from './remoteConfig'

interface RefreshRemoteConfigOptions {
  /**
   * Whether to use authenticated API (default: true).
   * Set to false during bootstrap before auth is initialized.
   */
  useAuth?: boolean
}

/**
 * Loads remote configuration from the backend /features endpoint
 * and updates the reactive remoteConfig ref
 */
export async function refreshRemoteConfig(
  options: RefreshRemoteConfigOptions = {}
): Promise<void> {
  const { useAuth = true } = options

  try {
    const response = useAuth
      ? await api.fetchApi('/features', { cache: 'no-store' })
      : await fetch('/api/features', { cache: 'no-store' })

    if (response.ok) {
      const config = await response.json()
      window.__CONFIG__ = config
      remoteConfig.value = config
      return
    }

    console.warn('Failed to load remote config:', response.statusText)
    if (response.status === 401 || response.status === 403) {
      window.__CONFIG__ = {}
      remoteConfig.value = {}
    }
  } catch (error) {
    console.error('Failed to fetch remote config:', error)
    window.__CONFIG__ = {}
    remoteConfig.value = {}
  }
}
