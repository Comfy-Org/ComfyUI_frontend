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

const mockIsSessionSuspended = vi.hoisted(() => vi.fn(() => false))
vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  isSessionSuspended: mockIsSessionSuspended
}))

vi.stubGlobal('fetch', vi.fn())

describe('refreshRemoteConfig', () => {
  const mockConfig = { feature1: true, feature2: 'value' }

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

    it('does not pass an abort signal on the authed branch (so it is never aborted)', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(mockSuccessResponse())

      await refreshRemoteConfig({ useAuth: true })

      const init = vi.mocked(api.fetchApi).mock.calls[0][1]
      expect(init?.signal).toBeUndefined()
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
    it('keeps the flags a suspended session cannot re-fetch', async () => {
      remoteConfig.value = { gtm_container_id: 'GTM-KEEP' }
      window.__CONFIG__ = { gtm_container_id: 'GTM-KEEP' }
      mockIsSessionSuspended.mockReturnValue(true)

      try {
        await refreshRemoteConfig()
      } finally {
        mockIsSessionSuspended.mockReturnValue(false)
      }

      // A suspended session answers with a synthetic 401, which the handler
      // below reads as "the server disowned these flags" and wipes. The
      // 10-minute poller would strip the export affordances out from under a
      // banner telling the user to go export their work.
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(remoteConfig.value).toEqual({ gtm_container_id: 'GTM-KEEP' })
      expect(window.__CONFIG__).toEqual({ gtm_container_id: 'GTM-KEEP' })
    })

    it('still refreshes without auth while suspended, since that path has no credential to reject', async () => {
      mockIsSessionSuspended.mockReturnValue(true)
      vi.mocked(global.fetch).mockResolvedValue(mockSuccessResponse())

      try {
        await refreshRemoteConfig({ useAuth: false })
      } finally {
        mockIsSessionSuspended.mockReturnValue(false)
      }

      expect(remoteConfig.value).toEqual(mockConfig)
    })

    it('clears config on 401 response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        mockErrorResponse(401, 'Unauthorized')
      )

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
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
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      await refreshRemoteConfig()

      expect(remoteConfig.value).toEqual({})
      expect(window.__CONFIG__).toEqual({})
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
    })
  })
})
