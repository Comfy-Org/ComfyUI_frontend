import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import {
  invalidateRemoteConfig,
  refreshRemoteConfig
} from './refreshRemoteConfig'
import {
  authenticatedRemoteConfigState,
  cachedLegacyBillingMigrationEnabled,
  remoteConfig,
  remoteConfigErrorStatus,
  remoteConfigRevision,
  remoteConfigState,
  sessionAgentGrant,
  sessionAgentGrantValidUntil
} from './remoteConfig'

vi.mock(import('@/scripts/api'))

describe('refreshRemoteConfig', () => {
  const mockConfig = { feature1: true, feature2: 'value' }

  function mockSuccessResponse(config: Record<string, unknown> = mockConfig) {
    return {
      ok: true,
      json: async () => config
    } as Response
  }

  function storageEntries(store: Storage): Record<string, string | null> {
    return Object.fromEntries(
      Object.keys(store).map((key) => [key, store.getItem(key)])
    )
  }

  function mockErrorResponse(status: number, statusText: string) {
    return {
      ok: false,
      status,
      statusText
    } as Response
  }

  function mockAuthenticatedFetch(response: Response): void {
    vi.mocked(api.fetchApi).mockImplementation(async (_route, options) => {
      options?.onAuthHeader?.(true)
      return response
    })
  }

  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation(
      (route: string) => `/ComfyUI/api${route}`
    )
    vi.stubGlobal('fetch', vi.fn())
    remoteConfig.value = {}
    remoteConfigErrorStatus.value = null
    remoteConfigState.value = 'unloaded'
    authenticatedRemoteConfigState.value = 'unloaded'
    remoteConfigRevision.value = 0
    cachedLegacyBillingMigrationEnabled.value = undefined
    sessionAgentGrant.value = undefined
    sessionAgentGrantValidUntil.value = undefined
    window.__CONFIG__ = {}
  })

  it('retains base URLs while invalidating identity-specific config', () => {
    remoteConfig.value = {
      subscription_required: true,
      comfy_api_base_url: 'https://api.example.com',
      comfy_cloud_base_url: 'https://cloud.example.com',
      comfy_platform_base_url: 'https://platform.example.com'
    }
    window.__CONFIG__ = remoteConfig.value

    invalidateRemoteConfig()

    expect(remoteConfig.value).toEqual({
      comfy_api_base_url: 'https://api.example.com',
      comfy_cloud_base_url: 'https://cloud.example.com',
      comfy_platform_base_url: 'https://platform.example.com'
    })
    expect(window.__CONFIG__).toEqual(remoteConfig.value)
    expect(remoteConfigState.value).toBe('unloaded')
    expect(authenticatedRemoteConfigState.value).toBe('unloaded')
    expect(sessionAgentGrantValidUntil.value).toBeUndefined()
  })

  describe('with auth (default)', () => {
    it('uses api.fetchApi when useAuth is true', async () => {
      mockAuthenticatedFetch(mockSuccessResponse())

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
      mockAuthenticatedFetch(mockSuccessResponse())

      await refreshRemoteConfig()

      expect(api.fetchApi).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('rejects a successful response when no auth header was attached', async () => {
      remoteConfig.value = { subscription_required: true }
      window.__CONFIG__ = remoteConfig.value
      vi.mocked(api.fetchApi).mockImplementation(async (_route, options) => {
        options?.onAuthHeader?.(false)
        return mockSuccessResponse({ 'agent-in-app-experience': true })
      })

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({ subscription_required: true })
      expect(authenticatedRemoteConfigState.value).toBe('error')
      expect(remoteConfigState.value).toBe('error')
      expect(remoteConfigRevision.value).toBe(1)
    })

    it('restores the prior state when the caller cancels the refresh', async () => {
      authenticatedRemoteConfigState.value = 'error'
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, options) =>
          new Promise<Response>((_, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
      )
      const controller = new AbortController()

      const refresh = refreshRemoteConfig({ signal: controller.signal })
      expect(authenticatedRemoteConfigState.value).toBe('loading')
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
      controller.abort()
      await refresh

      expect(authenticatedRemoteConfigState.value).toBe('error')
    })

    it('caches authenticated legacy billing migration eligibility', async () => {
      mockAuthenticatedFetch(
        mockSuccessResponse({ legacy_billing_migration_enabled: true })
      )

      await refreshRemoteConfig()

      expect(cachedLegacyBillingMigrationEnabled.value).toBe(true)
    })

    it('passes an AbortSignal on the authenticated branch', async () => {
      mockAuthenticatedFetch(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: true })

      const init = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('discards a failed response from a superseded refresh', async () => {
      let resolveFirst: ((response: Response) => void) | undefined
      vi.mocked(api.fetchApi)
        .mockImplementationOnce(
          (_route, options) =>
            new Promise<Response>((resolve) => {
              options?.onAuthHeader?.(true)
              resolveFirst = resolve
            })
        )
        .mockImplementationOnce(async (_route, options) => {
          options?.onAuthHeader?.(true)
          return mockSuccessResponse({ subscription_required: true })
        })

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
            options?.onAuthHeader?.(true)
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

    it('keeps authenticated state settled while polling', async () => {
      authenticatedRemoteConfigState.value = 'authenticated'
      let resolveRefresh: ((response: Response) => void) | undefined
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, options) =>
          new Promise<Response>((resolve) => {
            options?.onAuthHeader?.(true)
            resolveRefresh = resolve
          })
      )

      const refresh = refreshRemoteConfig()

      expect(authenticatedRemoteConfigState.value).toBe('authenticated')
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
      resolveRefresh?.(mockSuccessResponse())
      await refresh
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

    it('clears authenticated state and its grant when anonymous config commits', async () => {
      authenticatedRemoteConfigState.value = 'authenticated'
      sessionAgentGrant.value = true
      sessionAgentGrantValidUntil.value = Date.now() + 60_000
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: false })

      expect(authenticatedRemoteConfigState.value).toBe('unloaded')
      expect(sessionAgentGrant.value).toBeUndefined()
      expect(sessionAgentGrantValidUntil.value).toBeUndefined()
    })

    it('does not erase authenticated config or its grant on an anonymous 401', async () => {
      const existingConfig = {
        subscription_required: false,
        'agent-in-app-experience': true
      }
      remoteConfig.value = existingConfig
      window.__CONFIG__ = existingConfig
      authenticatedRemoteConfigState.value = 'authenticated'
      sessionAgentGrant.value = true
      sessionAgentGrantValidUntil.value = Date.now() + 60_000
      vi.mocked(global.fetch).mockResolvedValue(
        mockErrorResponse(401, 'Unauthorized')
      )

      await refreshRemoteConfig({ useAuth: false })

      expect(remoteConfig.value).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(sessionAgentGrant.value).toBe(true)
      expect(authenticatedRemoteConfigState.value).toBe('authenticated')
      expect(remoteConfigErrorStatus.value).toBeNull()
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
      mockAuthenticatedFetch(mockErrorResponse(401, 'Unauthorized'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
      expect(cachedLegacyBillingMigrationEnabled.value).toBeUndefined()
    })

    it("records this session's grant without persisting it anywhere", async () => {
      sessionAgentGrant.value = undefined
      const localStorageBefore = storageEntries(localStorage)
      const sessionStorageBefore = storageEntries(sessionStorage)
      mockAuthenticatedFetch(
        mockSuccessResponse({ 'agent-in-app-experience': true })
      )

      await refreshRemoteConfig()

      expect(sessionAgentGrant.value).toBe(true)
      expect(sessionAgentGrantValidUntil.value).toBeGreaterThan(Date.now())
      expect(storageEntries(localStorage)).toEqual(localStorageBefore)
      expect(storageEntries(sessionStorage)).toEqual(sessionStorageBefore)
    })

    it('reactively expires the transient session grant', async () => {
      vi.useFakeTimers()
      mockAuthenticatedFetch(
        mockSuccessResponse({ 'agent-in-app-experience': true })
      )

      await refreshRemoteConfig()
      await vi.advanceTimersByTimeAsync(15 * 60_000)

      expect(sessionAgentGrant.value).toBeUndefined()
      expect(sessionAgentGrantValidUntil.value).toBeUndefined()
    })

    it('keeps this session granted when the poll fails transiently', async () => {
      sessionAgentGrant.value = true
      mockAuthenticatedFetch(mockErrorResponse(503, 'Service Unavailable'))

      await refreshRemoteConfig()

      expect(sessionAgentGrant.value).toBe(true)
    })

    it('drops the grant when auth itself is rejected', async () => {
      sessionAgentGrant.value = true
      mockAuthenticatedFetch(mockErrorResponse(401, 'Unauthorized'))

      await refreshRemoteConfig()

      expect(sessionAgentGrant.value).toBeUndefined()
    })

    it('clears config on 403 response', async () => {
      mockAuthenticatedFetch(mockErrorResponse(403, 'Forbidden'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('preserves config on fetch error', async () => {
      const existingConfig = {
        subscription_required: true,
        comfy_cloud_base_url: 'https://cloud.example.com'
      }
      cachedLegacyBillingMigrationEnabled.value = true
      remoteConfig.value = existingConfig
      window.__CONFIG__ = existingConfig
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(cachedLegacyBillingMigrationEnabled.value).toBeUndefined()
    })

    it('preserves config on 500 response', async () => {
      const existingConfig = { subscription_required: true }
      remoteConfig.value = existingConfig
      window.__CONFIG__ = existingConfig

      mockAuthenticatedFetch(mockErrorResponse(500, 'Internal Server Error'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(remoteConfigState.value).toBe('error')
      expect(remoteConfigErrorStatus.value).toBeNull()
    })
  })
})
