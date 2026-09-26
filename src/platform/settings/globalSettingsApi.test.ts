import type { GlobalSetting } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import {
  GlobalSettingsApiError,
  getGlobalSetting,
  setGlobalSetting
} from './globalSettingsApi'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))
const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
vi.mock(import('@/scripts/api'))
const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/auth/unified/remintRetry'), () => ({
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
  vi.mocked(api.fetchApi).mockResolvedValueOnce(response.clone())
  fetchWithUnifiedRemint.mockResolvedValueOnce(response)
}

describe('Global Settings transport', () => {
  beforeEach(() => {
    distribution.isCloud = true
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
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
      expect(api.fetchApi).not.toHaveBeenCalled()
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
      expect(api.fetchApi).not.toHaveBeenCalled()
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
    vi.mocked(api.fetchApi).mockResolvedValueOnce(new Response('{not-json'))
    fetchWithUnifiedRemint.mockResolvedValueOnce(new Response('{not-json'))
    await expect(getGlobalSetting(key, authHeader)).rejects.toBeInstanceOf(
      GlobalSettingsApiError
    )
  })

  // An unreadable body and a rejected request are both `GlobalSettingsApiError`
  // with a status. Telemetry classifies them apart from the declared kind, so
  // it never has to read the message — which for these two errors is the only
  // thing that distinguishes them.
  // `!response.ok` is checked before the body is read, so an unreadable body
  // only reaches this branch on a 2xx or on the 404 the caller inspects — which
  // is why the status is worth carrying alongside the kind.
  it('declares an unreadable body as a malformed response, not a rejection', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response('<html>hello</html>', { status: 200 })
    )
    await expect(getGlobalSetting(key, authHeader)).rejects.toMatchObject({
      failureKind: 'malformed_response',
      status: 200
    })
  })

  it('declares an unreadable 404 body as a malformed response', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response('not json', { status: 404 })
    )
    await expect(getGlobalSetting(key, authHeader)).rejects.toMatchObject({
      failureKind: 'malformed_response',
      status: 404
    })
  })

  it('leaves a plainly rejected request for the status to classify', async () => {
    respondWith({ code: 'UNAUTHENTICATED', message: 'no' }, 401)
    await expect(getGlobalSetting(key, authHeader)).rejects.toMatchObject({
      failureKind: undefined,
      status: 401
    })
  })

  it('declares a schema-invalid payload as a malformed response', async () => {
    respondWith({ value: true })
    await expect(getGlobalSetting(key, authHeader)).rejects.toMatchObject({
      failureKind: 'malformed_response'
    })
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
