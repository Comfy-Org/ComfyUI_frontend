import type { GlobalSetting } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GlobalSettingsApiError,
  getGlobalSetting,
  setGlobalSetting
} from './globalSettingsApi'

vi.mock<unknown>(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))
const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock<unknown>(import('@/platform/distribution/types'), () => distribution)
const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { fetchApi, apiURL: (path: string) => `/api${path}` }
}))
const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/auth/unified/remintRetry'), () => ({
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
    'reads with captured workspace credentials (Cloud=%s)',
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
})
