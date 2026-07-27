import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  getDownloadAuth,
  logoutProvider,
  startProviderLogin
} from '../api/modelDownloadApi'
import type { DownloadProvider, ProviderAuthStatus } from '../types'
import { DownloadApiError } from '../types'

const POLL_INTERVAL_MS = 2_000
const LOGIN_TIMEOUT_MS = 5 * 60 * 1_000

/**
 * Result of an OAuth login attempt:
 * - `logged_in` — a token was stored; the provider is now authenticated.
 * - `needs_env_key` — OAuth is unavailable (not configured); the caller should
 *   fall back to the env-var API-key instructions.
 * - `failed` — the login errored or timed out; the caller should offer a retry
 *   and the env-var instructions.
 */
type LoginOutcome = 'logged_in' | 'needs_env_key' | 'failed'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useDownloadAuthStore = defineStore('downloadAuth', () => {
  const providers = ref<ProviderAuthStatus[]>([])
  const isLoading = ref(false)

  const statusByProvider = computed(
    () => new Map(providers.value.map((p) => [p.provider, p]))
  )

  function statusFor(
    provider: DownloadProvider
  ): ProviderAuthStatus | undefined {
    return statusByProvider.value.get(provider)
  }

  function isAuthenticated(provider: DownloadProvider): boolean {
    const status = statusFor(provider)
    return !!status && (status.env_key_present || status.logged_in)
  }

  async function fetchStatus() {
    isLoading.value = true
    try {
      providers.value = await getDownloadAuth()
    } finally {
      isLoading.value = false
    }
  }

  async function pollUntilResolved(
    provider: DownloadProvider
  ): Promise<LoginOutcome> {
    const deadline = Date.now() + LOGIN_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)
      await fetchStatus().catch(() => {})
      const status = statusFor(provider)
      if (status?.logged_in) return 'logged_in'
      if (!status?.login_in_progress) return 'failed'
    }
    return 'failed'
  }

  async function login(provider: DownloadProvider): Promise<LoginOutcome> {
    try {
      const { authorize_url } = await startProviderLogin(provider)
      window.open(authorize_url, '_blank', 'noopener')
    } catch (error) {
      if (!(error instanceof DownloadApiError)) return 'failed'
      if (error.is('OAUTH_NOT_CONFIGURED')) return 'needs_env_key'
      // A login already running just needs polling; anything else is a failure.
      if (!error.is('LOGIN_IN_PROGRESS')) return 'failed'
    }
    return pollUntilResolved(provider)
  }

  async function logout(provider: DownloadProvider) {
    await logoutProvider(provider)
    await fetchStatus()
  }

  return {
    providers,
    isLoading,
    statusFor,
    isAuthenticated,
    fetchStatus,
    login,
    logout
  }
})
