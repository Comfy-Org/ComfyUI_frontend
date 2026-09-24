vi.mock(import('firebase/auth'))
vi.mock(import('@/services/dialogService'))
import type { GlobalSetting } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/authStore'

import {
  GlobalSettingsApiError,
  getGlobalSetting,
  getGlobalSettingsAuthHeader,
  setGlobalSetting
} from './globalSettingsApi'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))
const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { fetchApi, apiURL: (path: string) => `/api${path}` }
}))
const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/auth/unified/remintRetry'), () => ({
  attachUnifiedRemintInterceptor: vi.fn(),
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))
const key = 'Comfy.AgentPanel.ConsentAccepted'
const stored: GlobalSetting = {
  key,
  value: true,
  updated_at: '2026-09-09T00:00:00Z'
}
const authHeader = { Authorization: 'Bearer workspace-a-token' } as const

function respondWith(body: unknown, status = 200): void {
  const response = new Response(JSON.stringify(body), { status })
  fetchApi.mockResolvedValueOnce(response.clone())
  fetchWithUnifiedRemint.mockResolvedValueOnce(response)
}

describe('Global Settings transport', () => {
  beforeEach(() => {
    distribution.isCloud = true
  })

  it.for([true, false])(
    'reads with the credential it is handed (Cloud=%s)',
    async (cloud) => {
      distribution.isCloud = cloud
      respondWith(stored)

      await expect(getGlobalSetting(key, authHeader)).resolves.toEqual(stored)
      expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
        `${cloud ? '' : 'https://api.comfy.test'}/api/global-settings/${key}`,
        expect.objectContaining({ cache: 'no-store', headers: authHeader }),
        false
      )
      expect(fetchApi).not.toHaveBeenCalled()
    }
  )

  it.for([true, false])(
    'posts a typed value to the collection (Cloud=%s)',
    async (cloud) => {
      distribution.isCloud = cloud
      respondWith(stored)

      await expect(
        setGlobalSetting({ key, value: true }, authHeader)
      ).resolves.toEqual(stored)
      expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
        `${cloud ? '' : 'https://api.comfy.test'}/api/global-settings`,
        expect.objectContaining({
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: true })
        }),
        false
      )
      expect(fetchApi).not.toHaveBeenCalled()
    }
  )

  it('treats the typed missing setting response as unset', async () => {
    respondWith(
      {
        code: 'NOT_FOUND',
        message: 'Setting is not set for this user and workspace'
      },
      404
    )
    await expect(getGlobalSetting(key, authHeader)).resolves.toBeUndefined()
  })

  it('does not treat a missing gateway route as an unset setting', async () => {
    respondWith({ message: 'Not Found' }, 404)
    await expect(getGlobalSetting(key, authHeader)).rejects.toBeInstanceOf(
      GlobalSettingsApiError
    )
  })

  it.for([
    { value: true },
    { ...stored, key: 'unknown' },
    { ...stored, value: false },
    { ...stored, updated_at: 'invalid' }
  ])('rejects a malformed stored setting: %j', async (body) => {
    respondWith(body)
    await expect(getGlobalSetting(key, authHeader)).rejects.toBeInstanceOf(
      GlobalSettingsApiError
    )
  })

  it('rejects a successful save without a valid stored setting', async () => {
    respondWith({ value: true })
    await expect(
      setGlobalSetting({ key, value: true }, authHeader)
    ).rejects.toBeInstanceOf(GlobalSettingsApiError)
  })

  it('wraps invalid JSON responses', async () => {
    fetchApi.mockResolvedValueOnce(new Response('{not-json'))
    fetchWithUnifiedRemint.mockResolvedValueOnce(new Response('{not-json'))
    await expect(getGlobalSetting(key, authHeader)).rejects.toBeInstanceOf(
      GlobalSettingsApiError
    )
  })

  it('surfaces rejected writes', async () => {
    respondWith(
      { code: 'INTERNAL_ERROR', message: 'Failed to store setting' },
      500
    )
    await expect(
      setGlobalSetting({ key, value: true }, authHeader)
    ).rejects.toMatchObject({ status: 500 })
  })

  // The endpoint and its credential are chosen together. A workspace token is
  // minted by the cloud and valid only at ingest; sent to the Comfy API it is
  // rejected as an invalid auth token, which is what a signed-in local build
  // with an active workspace used to hit on every consent read and write.
  it.for([
    { cloud: true, source: 'getWorkspaceAuthHeader' as const },
    { cloud: false, source: 'getUserAuthHeader' as const }
  ])(
    "authenticates Cloud=$cloud with the store's $source",
    async ({ cloud, source }) => {
      distribution.isCloud = cloud
      const authStore = useAuthStore()
      vi.mocked(authStore.getWorkspaceAuthHeader).mockResolvedValue({
        Authorization: 'Bearer workspace-token'
      })
      vi.mocked(authStore.getUserAuthHeader).mockResolvedValue({
        Authorization: 'Bearer user-token'
      })

      await expect(getGlobalSettingsAuthHeader()).resolves.toEqual({
        Authorization:
          source === 'getWorkspaceAuthHeader'
            ? 'Bearer workspace-token'
            : 'Bearer user-token'
      })
    }
  )
})
