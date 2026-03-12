import { fromZodError } from 'zod-validation-error'

import { api } from '@/scripts/api'

import { remoteConfig, remoteConfigState } from './remoteConfig'
import { remoteConfigSchema } from './remoteConfigSchema'
import type { RemoteConfig } from './types'

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

  try {
    const response = useAuth
      ? await api.fetchApi('/features', { cache: 'no-store' })
      : await fetch('/api/features', { cache: 'no-store' })

    if (response.ok) {
      const json = await response.json()
      const result = remoteConfigSchema.safeParse(json)

      if (!result.success) {
        console.warn(
          'Invalid remote config response:',
          fromZodError(result.error).message
        )
        window.__CONFIG__ = {}
        remoteConfig.value = {}
        remoteConfigState.value = 'error'
        return
      }

      const config = result.data as RemoteConfig
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
