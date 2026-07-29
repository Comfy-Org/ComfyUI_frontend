import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { refreshRemoteConfig } from './refreshRemoteConfig'
import { remoteConfig } from './remoteConfig'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((route: string) => `/ComfyUI/api${route}`)
  }
}))

vi.stubGlobal('fetch', vi.fn())

describe('refreshRemoteConfig', () => {
  const mockConfig = { feature1: true, feature2: 'value' }
  let sessionId = 'user-a'

  function refreshAuthenticated() {
    return refreshRemoteConfig({
      getSessionId: () => sessionId
    })
  }

  function mockSuccessResponse(config = mockConfig) {
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
    vi.clearAllMocks()
    remoteConfig.value = {}
    window.__CONFIG__ = {}
    sessionId = 'user-a'
  })

  describe('with auth (default)', () => {
    it('deduplicates concurrent authenticated refreshes', async () => {
      let resolveResponse: (response: Response) => void
      const pendingResponse = new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
      vi.mocked(api.fetchApi).mockReturnValue(pendingResponse)

      const firstRefresh = refreshAuthenticated()
      const secondRefresh = refreshAuthenticated()

      expect(secondRefresh).toBe(firstRefresh)
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())

      resolveResponse!(mockSuccessResponse())
      await Promise.all([firstRefresh, secondRefresh])

      expect(api.fetchApi).toHaveBeenCalledOnce()

      vi.mocked(api.fetchApi).mockResolvedValueOnce(mockSuccessResponse())
      await refreshAuthenticated()

      expect(api.fetchApi).toHaveBeenCalledTimes(2)
    })

    it('uses api.fetchApi when useAuth is true', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({
        useAuth: true,
        getSessionId: () => sessionId
      })

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

      await refreshAuthenticated()

      expect(api.fetchApi).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('does not pass an abort signal on the authed branch (so it is never aborted)', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({
        useAuth: true,
        getSessionId: () => sessionId
      })

      const init = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(init?.signal).toBeUndefined()
    })

    it('keeps the new session refresh deduplicated when the old one settles', async () => {
      let resolveOldResponse: (response: Response) => void
      let resolveNewResponse: (response: Response) => void
      vi.mocked(api.fetchApi)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOldResponse = resolve
          })
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveNewResponse = resolve
          })
        )

      const oldRefresh = refreshAuthenticated()
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())

      sessionId = 'user-b'
      const newRefresh = refreshAuthenticated()
      await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledTimes(2))

      resolveOldResponse!(
        mockSuccessResponse({ feature1: true, feature2: 'stale' })
      )
      await oldRefresh

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})

      const repeatedNewRefresh = refreshAuthenticated()
      expect(repeatedNewRefresh).toBe(newRefresh)
      expect(api.fetchApi).toHaveBeenCalledTimes(2)

      resolveNewResponse!(
        mockSuccessResponse({ feature1: true, feature2: 'current' })
      )
      await Promise.all([newRefresh, repeatedNewRefresh])

      const currentConfig = { feature1: true, feature2: 'current' }
      expect(remoteConfig.value).toEqual(currentConfig)
      expect(window.__CONFIG__).toEqual(currentConfig)
    })

    it('starts a new request after a failed authenticated refresh', async () => {
      vi.mocked(api.fetchApi)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse())

      await refreshAuthenticated()
      await refreshAuthenticated()

      expect(api.fetchApi).toHaveBeenCalledTimes(2)
      expect(remoteConfig.value).toEqual(mockConfig)
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
      expect(remoteConfig.value).toEqual(mockConfig)
      expect(window.__CONFIG__).toEqual(mockConfig)
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
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(401, 'Unauthorized')
      )

      await refreshAuthenticated()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('clears config on 403 response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(403, 'Forbidden')
      )

      await refreshAuthenticated()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('clears config on fetch error', async () => {
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await refreshAuthenticated()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
    })

    it('clears release flags but preserves other config on 500 response', async () => {
      const existingConfig = {
        subscription_required: true,
        release_flags: { might_be_risky_feature_foo: true }
      }
      remoteConfig.value = existingConfig
      window.__CONFIG__ = existingConfig

      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(500, 'Internal Server Error')
      )

      await refreshAuthenticated()

      const safeConfig = { subscription_required: true }
      expect(remoteConfig.value).toEqual(safeConfig)
      expect(window.__CONFIG__).toEqual(safeConfig)
    })
  })
})
