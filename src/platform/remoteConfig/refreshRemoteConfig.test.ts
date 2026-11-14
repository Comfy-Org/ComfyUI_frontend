import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'

import {
  invalidateRemoteConfig,
  loadRemoteConfigUntilReady,
  refreshRemoteConfig
} from './refreshRemoteConfig'
import { useRemoteConfigStore } from './remoteConfigStore'

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
    const store = useRemoteConfigStore()
    store.acceptConfig({}, false)
    store.invalidate()
  })

  it('retains base URLs while invalidating identity-specific config', () => {
    const store = useRemoteConfigStore()
    store.acceptConfig(
      {
        subscription_required: true,
        'agent-in-app-experience': true,
        comfy_api_base_url: 'https://api.example.com',
        comfy_cloud_base_url: 'https://cloud.example.com',
        comfy_platform_base_url: 'https://platform.example.com'
      },
      true
    )
    expect(store.agentGrant).toBe(true)

    invalidateRemoteConfig()

    expect(store.config).toEqual({
      comfy_api_base_url: 'https://api.example.com',
      comfy_cloud_base_url: 'https://cloud.example.com',
      comfy_platform_base_url: 'https://platform.example.com'
    })
    expect(window.__CONFIG__).toEqual(store.config)
    expect(store.loadState).toBe('unloaded')
    expect(store.agentGrant).toBeUndefined()
    expect(store.authenticatedLoadState).toBe('unloaded')
    expect(store.agentGrantValidUntil).toBeUndefined()
  })

  it('persists the authenticated server flags to localStorage', async () => {
    mockAuthenticatedFetch(
      mockSuccessResponse({
        billing_control_enabled: true,
        v1_payment_recovery: true
      })
    )

    await refreshRemoteConfig()
    await nextTick()

    expect(localStorage.getItem('billing_control_enabled')).toBe('true')
    expect(localStorage.getItem('v1_payment_recovery')).toBe('true')
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
      expect(useRemoteConfigStore().config).toEqual(mockConfig)
      expect(window.__CONFIG__).toEqual(mockConfig)
    })

    it('uses api.fetchApi by default', async () => {
      mockAuthenticatedFetch(mockSuccessResponse())

      await refreshRemoteConfig()

      expect(api.fetchApi).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('rejects a successful response when no auth header was attached', async () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ subscription_required: true }, false)
      vi.mocked(api.fetchApi).mockImplementation(async (_route, options) => {
        options?.onAuthHeader?.(false)
        return mockSuccessResponse({ 'agent-in-app-experience': true })
      })

      await refreshRemoteConfig()

      expect(store.config).toEqual({ subscription_required: true })
      expect(store.authenticatedLoadState).toBe('error')
      expect(store.loadState).toBe('error')
    })

    it('restores the prior state when the caller cancels the refresh', async () => {
      const store = useRemoteConfigStore()
      store.failLoad(true)
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
      expect(store.authenticatedLoadState).toBe('loading')
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
      controller.abort()
      await refresh

      expect(store.authenticatedLoadState).toBe('error')
    })

    it('passes an AbortSignal on the authenticated branch', async () => {
      mockAuthenticatedFetch(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: true })

      const init = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it.for([200, 401])(
      'discards a superseded response with status %s without changing cached flags',
      async (status) => {
        const latestConfig = {
          subscription_required: true,
          billing_control_enabled: false,
          v1_payment_recovery: false
        }
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
            return mockSuccessResponse(latestConfig)
          })

        const store = useRemoteConfigStore()
        const firstRefresh = refreshRemoteConfig({ useAuth: true })
        await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(1))
        await refreshRemoteConfig({ useAuth: true })
        expect(store.cachedBillingControlEnabled).toBe(false)
        expect(store.cachedV1PaymentRecovery).toBe(false)
        resolveFirst?.(
          new Response(
            JSON.stringify({
              billing_control_enabled: true,
              v1_payment_recovery: true
            }),
            { status }
          )
        )
        await firstRefresh

        expect(store.config).toEqual(latestConfig)
        expect(store.loadState).toBe('authenticated')
        expect(store.errorStatus).toBeNull()
        expect(store.cachedBillingControlEnabled).toBe(false)
        expect(store.cachedV1PaymentRecovery).toBe(false)
      }
    )

    it('preserves shared state when the caller cancels the refresh', async () => {
      const existingConfig = { subscription_required: true }
      const store = useRemoteConfigStore()
      store.acceptConfig(existingConfig, true)
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

      expect(store.config).toEqual(existingConfig)
      expect(store.loadState).toBe('authenticated')
      expect(store.authenticatedLoadState).toBe('authenticated')
      expect(window.__CONFIG__).toEqual(existingConfig)
    })

    it('keeps authenticated state settled while polling', async () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({}, true)
      let resolveRefresh: ((response: Response) => void) | undefined
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, options) =>
          new Promise<Response>((resolve) => {
            options?.onAuthHeader?.(true)
            resolveRefresh = resolve
          })
      )

      const refresh = refreshRemoteConfig()

      expect(store.authenticatedLoadState).toBe('authenticated')
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
      resolveRefresh?.(mockSuccessResponse())
      await refresh
    })
  })

  describe('without auth', () => {
    it('builds the no-auth url via api.apiURL so a path prefix is respected', async () => {
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: false })

      expect(api.apiURL).toHaveBeenCalledWith('/features')
      expect(global.fetch).toHaveBeenCalledWith(
        '/ComfyUI/api/features',
        expect.objectContaining({ cache: 'no-store' })
      )
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(useRemoteConfigStore().config).toEqual(mockConfig)
      expect(window.__CONFIG__).toEqual(mockConfig)
    })

    it('clears authenticated state and its grant when anonymous config commits', async () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: false })

      expect(store.authenticatedLoadState).toBe('unloaded')
      expect(store.agentGrant).toBeUndefined()
      expect(store.agentGrantValidUntil).toBeUndefined()
    })

    it('keeps anonymous state after an older authenticated refresh settles', async () => {
      const store = useRemoteConfigStore()
      store.failLoad(true)
      let resolveAuthenticated: ((response: Response) => void) | undefined
      vi.mocked(api.fetchApi).mockImplementation(
        (_route, options) =>
          new Promise<Response>((resolve) => {
            options?.onAuthHeader?.(true)
            resolveAuthenticated = resolve
          })
      )
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      const authenticatedRefresh = refreshRemoteConfig()
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
      await refreshRemoteConfig({ useAuth: false })
      resolveAuthenticated?.(mockSuccessResponse())
      await authenticatedRefresh

      expect(store.authenticatedLoadState).toBe('unloaded')
      expect(store.loadState).toBe('anonymous')
    })

    it('does not erase authenticated config or its grant on an anonymous 401', async () => {
      const existingConfig = {
        subscription_required: false,
        'agent-in-app-experience': true
      }
      const store = useRemoteConfigStore()
      store.acceptConfig(existingConfig, true)
      vi.mocked(global.fetch).mockResolvedValue(
        mockErrorResponse(401, 'Unauthorized')
      )

      await refreshRemoteConfig({ useAuth: false })

      expect(store.config).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(store.agentGrant).toBe(true)
      expect(store.authenticatedLoadState).toBe('authenticated')
      expect(store.errorStatus).toBeNull()
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

      expect(useRemoteConfigStore().config).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })
  })

  describe('error handling', () => {
    it('clears config on 401 response', async () => {
      mockAuthenticatedFetch(mockErrorResponse(401, 'Unauthorized'))

      await refreshRemoteConfig()

      expect(useRemoteConfigStore().config).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it("records this session's grant without persisting it anywhere", async () => {
      localStorage.setItem('billing_control_enabled', 'false')
      localStorage.setItem('v1_payment_recovery', 'false')
      const localStorageBefore = storageEntries(localStorage)
      const sessionStorageBefore = storageEntries(sessionStorage)
      mockAuthenticatedFetch(
        mockSuccessResponse({ 'agent-in-app-experience': true })
      )

      await refreshRemoteConfig()

      const store = useRemoteConfigStore()
      expect(store.agentGrant).toBe(true)
      expect(store.agentGrantValidUntil).toBeGreaterThan(Date.now())
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

      const store = useRemoteConfigStore()
      expect(store.agentGrant).toBeUndefined()
      expect(store.agentGrantValidUntil).toBeUndefined()
    })

    it('keeps this session granted when the poll fails transiently', async () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      mockAuthenticatedFetch(mockErrorResponse(503, 'Service Unavailable'))

      await refreshRemoteConfig()

      expect(store.agentGrant).toBe(true)
    })

    it('drops the grant when auth itself is rejected', async () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      mockAuthenticatedFetch(mockErrorResponse(401, 'Unauthorized'))

      await refreshRemoteConfig()

      expect(store.agentGrant).toBeUndefined()
    })

    it('clears config on 403 response', async () => {
      mockAuthenticatedFetch(mockErrorResponse(403, 'Forbidden'))

      await refreshRemoteConfig()

      expect(useRemoteConfigStore().config).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('preserves config on fetch error', async () => {
      const existingConfig = {
        subscription_required: true,
        comfy_cloud_base_url: 'https://cloud.example.com'
      }
      const store = useRemoteConfigStore()
      store.acceptConfig(existingConfig, false)
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await refreshRemoteConfig()

      expect(store.config).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
    })

    it('preserves config on 500 response', async () => {
      const existingConfig = { subscription_required: true }
      const store = useRemoteConfigStore()
      store.acceptConfig(existingConfig, false)

      mockAuthenticatedFetch(mockErrorResponse(500, 'Internal Server Error'))

      await refreshRemoteConfig()

      expect(store.config).toEqual(existingConfig)
      expect(window.__CONFIG__).toEqual(existingConfig)
      expect(store.loadState).toBe('error')
      expect(store.errorStatus).toBeNull()
    })
  })

  describe('loadRemoteConfigUntilReady', () => {
    const BOOTSTRAP_RELEASE_MS = 30_000

    it('retries until /features loads instead of leaving startup on build-time defaults', async () => {
      vi.useFakeTimers()
      const serverConfig = { firebase_config: { projectId: 'dreamboothy' } }
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
        .mockResolvedValueOnce(mockErrorResponse(503, 'Service Unavailable'))
        .mockResolvedValueOnce(mockSuccessResponse(serverConfig))

      const loading = loadRemoteConfigUntilReady()
      await vi.runAllTimersAsync()
      await loading

      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(useRemoteConfigStore().loadState).toBe('anonymous')
      expect(useRemoteConfigStore().config).toEqual(serverConfig)
      vi.useRealTimers()
    })

    it('keeps retrying a 200 that omits firebase_config instead of booting on the build default', async () => {
      vi.useFakeTimers()
      const serverConfig = { firebase_config: { projectId: 'dreamboothy' } }
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          mockSuccessResponse({ subscription_required: true })
        )
        .mockResolvedValueOnce(mockSuccessResponse(serverConfig))

      const loading = loadRemoteConfigUntilReady()
      await vi.runAllTimersAsync()
      await loading

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(useRemoteConfigStore().config).toEqual(serverConfig)
      vi.useRealTimers()
    })

    it('stops waiting on a loopback host, whose server never names a project', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('location', { hostname: '127.0.0.1' })
      vi.mocked(global.fetch).mockResolvedValue(
        mockSuccessResponse({ subscription_required: true })
      )

      const loading = loadRemoteConfigUntilReady()
      await vi.runAllTimersAsync()
      await loading

      expect(global.fetch).toHaveBeenCalledTimes(2)
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('never reaches Firebase startup on deployed cloud that keeps answering without a project', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('location', { hostname: 'cloud.comfy.org' })
      vi.mocked(global.fetch).mockResolvedValue(
        mockSuccessResponse({ subscription_required: true })
      )
      const reachedFirebaseStartup = vi.fn()

      void loadRemoteConfigUntilReady().then(reachedFirebaseStartup)
      await vi.advanceTimersByTimeAsync(5 * 60_000)

      expect(reachedFirebaseStartup).not.toHaveBeenCalled()
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(5)

      vi.mocked(global.fetch).mockResolvedValue(
        mockSuccessResponse({ firebase_config: { projectId: 'dreamboothy' } })
      )
      await vi.advanceTimersByTimeAsync(BOOTSTRAP_RELEASE_MS)
      expect(reachedFirebaseStartup).toHaveBeenCalledOnce()

      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('accepts a 200 that names the dev project through firebase_env', async () => {
      vi.useFakeTimers()
      const serverConfig = { firebase_env: 'dev' as const }
      vi.mocked(global.fetch).mockResolvedValue(
        mockSuccessResponse(serverConfig)
      )

      const loading = loadRemoteConfigUntilReady()
      await vi.runAllTimersAsync()
      await loading

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(useRemoteConfigStore().config).toEqual(serverConfig)
      vi.useRealTimers()
    })
  })
})
