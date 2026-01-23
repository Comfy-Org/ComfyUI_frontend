import { api } from '@/scripts/api'

import { remoteConfig } from './remoteConfig'

export async function refreshRemoteConfig(): Promise<void> {
  try {
    const response = await api.fetchApi('/features', { cache: 'no-store' })
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
  }
}
