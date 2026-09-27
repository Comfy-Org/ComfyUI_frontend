import { promiseTimeout, until } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import type { ApiAuthProvider } from '@/platform/auth/apiAuthProvider'
import {
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest
} from '@/platform/auth/unified/remintRetry'
import { useTelemetry } from '@/platform/telemetry'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

const AUTH_INITIALIZATION_TIMEOUT_MS = 10_000

async function trackWsTokenUnavailable(): Promise<void> {
  try {
    if (!(await shouldRemintCloudRequest())) return
    useTelemetry()?.trackUnifiedAuthRetry({
      transport: 'ws',
      outcome: 'failed',
      failure_reason: 'token_unavailable'
    })
  } catch (err) {
    console.warn('Failed to report WebSocket token unavailability:', err)
  }
}

const cloudApiAuthProvider: ApiAuthProvider = {
  async waitForInitialization() {
    const authStore = useAuthStore()
    if (authStore.isInitialized) return

    const { isInitialized } = storeToRefs(authStore)
    try {
      await Promise.race([
        until(isInitialized).toBe(true),
        promiseTimeout(AUTH_INITIALIZATION_TIMEOUT_MS)
      ])
    } catch {
      console.warn('Firebase auth initialization timeout after 10 seconds')
    }
  },

  async getAuthHeader() {
    try {
      return await useAuthStore().getAuthHeader()
    } catch (error) {
      console.warn('Failed to get auth header:', error)
      return null
    }
  },

  async getAuthToken() {
    try {
      return await useAuthStore().getAuthToken()
    } catch (error) {
      void trackWsTokenUnavailable()
      console.warn('Could not get auth token for WebSocket connection:', error)
      return undefined
    }
  },

  shouldRetryOn401: shouldRemintCloudRequest,
  fetch: fetchWithUnifiedRemint
}

export function installCloudApiAuth(): void {
  api.setAuthProvider(cloudApiAuthProvider)
}
