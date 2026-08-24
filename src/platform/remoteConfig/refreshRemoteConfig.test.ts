import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { refreshRemoteConfig } from './refreshRemoteConfig'
import {
  cachedLegacyBillingMigrationEnabled,
  remoteConfig,
  remoteConfigErrorStatus,
  remoteConfigState
} from './remoteConfig'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((route: string) => `/ComfyUI/api${route}`)
  }
}))

describe('refreshRemoteConfig', () => {
  const mockConfig = { feature1: true, feature2: 'value' }

  function mockSuccessResponse(config: Record<string, unknown> = mockConfig) {
    return {
      ok: true,
      json: async () => config
    } as Response
  }

  function mockErrorResponse(status: number, statusText: string) {
    return {
      ok: false,
      status,
      statusText
    } as Response
  }

  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation(
      (route: string) => `/ComfyUI/api${route}`
    )
    vi.stubGlobal('fetch', vi.fn())
    remoteConfig.value = {}
    remoteConfigErrorStatus.value = null
    remoteConfigState.value = 'unloaded'
    cachedLegacyBillingMigrationEnabled.value = undefined
    window.__CONFIG__ = {}
  })

  describe('with auth (default)', () => {
    it('uses api.fetchApi when useAuth is true', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: true })

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/features',
        expect.objectContaining({ cache: 'no-store' })
      )
      expect(global.fetch).not.toHaveBeenCalled()
      expect(remoteConfig.value).toEqual(mockConfig)
      expect(window.__CONFIG__).toEqual(mockConfig)
    })

    it('uses api.fetchApi by default', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig()

      expect(api.fetchApi).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('caches authenticated legacy billing migration eligibility', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockSuccessResponse({ legacy_billing_migration_enabled: true })
      )

      await refreshRemoteConfig()

      expect(cachedLegacyBillingMigrationEnabled.value).toBe(true)
    })

    it('passes an AbortSignal on the authenticated branch', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: true })

      const init = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('discards a failed response from a superseded refresh', async () => {
      let resolveFirst: ((response: Response) => void) | undefined
      vi.mocked(api.fetchApi)
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveFirst = resolve
            })
        )
        .mockResolvedValueOnce(
          mockSuccessResponse({ subscription_required: true })
        )

      const firstRefresh = refreshRemoteConfig({ useAuth: true })
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(1))
      await refreshRemoteConfig({ useAuth: true })
      resolveFirst?.(mockErrorResponse(401, 'Unauthorized'))
      await firstRefresh

      expect(remoteConfig.value).toEqual({ subscription_required: true })
      expect(remoteConfigState.value).toBe('authenticated')
      expect(remoteConfigErrorStatus.value).toBeNull()
    })

    it('preserves shared state when the caller cancels the refresh', async () => {
      const existingConfig = { subscription_required: true }
      remoteConfig.value = existingConfig
      remoteConfigState.value = 'authenticated'
      remoteConfigErrorStatus.value = 500
      window.__CONFIG__ = existingConfig
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, options) =>
          new Promise<Response>((_, reject) => {
            if (options?.signal?.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
      )
      const controller = new AbortController()

      const refresh = refreshRemoteConfig({
        useAuth: true,
        signal: controller.signal
      })
      controller.abort()
      await refresh

      expect(remoteConfig.value).toEqual(existingConfig)
      expect(remoteConfigState.value).toBe('authenticated')
      expect(remoteConfigErrorStatus.value).toBe(500)
      expect(window.__CONFIG__).toEqual(existingConfig)
    })
  })

  describe('without auth', () => {
    it('builds the no-auth url via api.apiURL so a path prefix is respected', async () => {
      cachedLegacyBillingMigrationEnabled.value = true
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: false })

      expect(api.apiURL).toHaveBeenCalledWith('/features')
      expect(global.fetch).toHaveBeenCalledWith(
        '/ComfyUI/api/features',
        expect.objectContaining({ cache: 'no-store' })
      )
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(remoteConfig.value).toEqual(mockConfig)
      expect(window.__CONFIG__).toEqual(mockConfig)
      expect(cachedLegacyBillingMigrationEnabled.value).toBe(true)
    })
  })

  describe('timeout', () => {
    it('passes an AbortSignal so a wedged /features cannot hang startup', async () => {
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: false })

      const init = vi.mocked(global.fetch).mock.calls[0][1]
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('falls back to empty config when the request aborts', async () => {
      vi.mocked(global.fetch).mockRejectedValue(
        new DOMException('Aborted', 'AbortError')
      )

      await refreshRemoteConfig({ useAuth: false })

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })
  })

  describe('error handling', () => {
    it('clears config on 401 response', async () => {
      cachedLegacyBillingMigrationEnabled.value = true
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(401, 'Unauthorized')
      )

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
      expect(cachedLegacyBillingMigrationEnabled.value).toBeUndefined()
    })

    it('clears config on 403 response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(403, 'Forbidden')
      )

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('clears config on fetch error', async () => {
      cachedLegacyBillingMigrationEnabled.value = true
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
      expect(cachedLegacyBillingMigrationEnabled.value).toBeUndefined()
    })

    it('preserves config on 500 response', async () => {
      const existingConfig = { subscription_required: true }
      remoteConfig.value = existingConfig
      window.__CONFIG__ = existingConfig

      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(500, 'Internal Server Error')
      )

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(remoteConfigState.value).toBe('error')
      expect(remoteConfigErrorStatus.value).toBeNull()
    })
  })
})
