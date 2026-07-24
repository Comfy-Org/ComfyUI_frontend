import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as downloadApi from '../api/modelDownloadApi'
import type { ProviderAuthStatus } from '../types'
import { DownloadApiError } from '../types'
import { useDownloadAuthStore } from './downloadAuthStore'

vi.mock('../api/modelDownloadApi', () => ({
  getDownloadAuth: vi.fn(),
  startProviderLogin: vi.fn(),
  logoutProvider: vi.fn()
}))

function status(
  overrides: Partial<ProviderAuthStatus> = {}
): ProviderAuthStatus {
  return {
    provider: 'huggingface',
    env_key_present: false,
    logged_in: false,
    login_in_progress: false,
    ...overrides
  }
}

describe('useDownloadAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('fetchStatus / isAuthenticated', () => {
    it('stores the provider list and derives authentication', async () => {
      vi.mocked(downloadApi.getDownloadAuth).mockResolvedValue([
        status({ provider: 'huggingface', env_key_present: true }),
        status({ provider: 'civitai', logged_in: true })
      ])
      const store = useDownloadAuthStore()

      await store.fetchStatus()

      expect(store.isAuthenticated('huggingface')).toBe(true)
      expect(store.isAuthenticated('civitai')).toBe(true)
    })

    it('treats a provider with neither env key nor login as unauthenticated', async () => {
      vi.mocked(downloadApi.getDownloadAuth).mockResolvedValue([status()])
      const store = useDownloadAuthStore()

      await store.fetchStatus()

      expect(store.isAuthenticated('huggingface')).toBe(false)
    })
  })

  describe('login', () => {
    it('falls back to env-key instructions when OAuth is not configured', async () => {
      vi.mocked(downloadApi.startProviderLogin).mockRejectedValue(
        new DownloadApiError('no client', 'OAUTH_NOT_CONFIGURED', 400)
      )
      const store = useDownloadAuthStore()

      await expect(store.login('huggingface')).resolves.toBe('needs_env_key')
      expect(window.open).not.toHaveBeenCalled()
    })

    it('reports failure for an unexpected login error', async () => {
      vi.mocked(downloadApi.startProviderLogin).mockRejectedValue(
        new Error('network down')
      )
      const store = useDownloadAuthStore()

      await expect(store.login('huggingface')).resolves.toBe('failed')
    })

    it('opens the authorize url and resolves once the provider is logged in', async () => {
      vi.useFakeTimers()
      vi.mocked(downloadApi.startProviderLogin).mockResolvedValue({
        authorize_url: 'https://auth.example/go'
      })
      vi.mocked(downloadApi.getDownloadAuth)
        .mockResolvedValueOnce([status({ login_in_progress: true })])
        .mockResolvedValueOnce([status({ logged_in: true })])
      const store = useDownloadAuthStore()

      const pending = store.login('huggingface')
      await vi.advanceTimersByTimeAsync(2_000)
      await vi.advanceTimersByTimeAsync(2_000)

      await expect(pending).resolves.toBe('logged_in')
      expect(window.open).toHaveBeenCalledWith(
        'https://auth.example/go',
        '_blank',
        'noopener'
      )
    })

    it('reports failure when the login stops progressing without logging in', async () => {
      vi.useFakeTimers()
      vi.mocked(downloadApi.startProviderLogin).mockResolvedValue({
        authorize_url: 'https://auth.example/go'
      })
      vi.mocked(downloadApi.getDownloadAuth).mockResolvedValue([
        status({ login_in_progress: false, logged_in: false })
      ])
      const store = useDownloadAuthStore()

      const pending = store.login('huggingface')
      await vi.advanceTimersByTimeAsync(2_000)

      await expect(pending).resolves.toBe('failed')
    })
  })

  describe('logout', () => {
    it('clears the token and refreshes status', async () => {
      vi.mocked(downloadApi.logoutProvider).mockResolvedValue(undefined)
      vi.mocked(downloadApi.getDownloadAuth).mockResolvedValue([status()])
      const store = useDownloadAuthStore()

      await store.logout('huggingface')

      expect(downloadApi.logoutProvider).toHaveBeenCalledWith('huggingface')
      expect(downloadApi.getDownloadAuth).toHaveBeenCalled()
    })
  })
})
