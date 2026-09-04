import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AccountSettingsApiError,
  getAccountSetting,
  setAccountSetting
} from './accountSettingsApi'

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test',
  getComfyCloudBaseUrl: () => 'https://cloud.comfy.test'
}))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock('@/platform/distribution/types', () => distribution)

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock('@/platform/auth/unified/remintRetry', () => ({
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))

const authHeader = { Authorization: 'Bearer account-token' } as const

function respondWith(response: Response): void {
  fetchApi.mockResolvedValueOnce(response.clone())
  fetchWithUnifiedRemint.mockResolvedValueOnce(response)
}

describe('accountSettingsApi', () => {
  beforeEach(() => {
    distribution.isCloud = true
    fetchApi.mockReset()
    fetchWithUnifiedRemint.mockReset()
  })

  it('reads a Cloud setting through the existing relative API path', async () => {
    respondWith(new Response(JSON.stringify({ value: true }), { status: 200 }))

    await expect(
      getAccountSetting('Comfy.Agent Consent', authHeader)
    ).resolves.toBe(true)
    expect(fetchApi).toHaveBeenCalledWith('/settings/Comfy.Agent%20Consent')
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
  })

  it('treats a missing account setting as unset', async () => {
    respondWith(new Response(null, { status: 404 }))

    await expect(getAccountSetting('missing', authHeader)).resolves.toBe(
      undefined
    )
  })

  it('rejects malformed successful responses', async () => {
    respondWith(new Response(JSON.stringify(true), { status: 200 }))

    await expect(
      getAccountSetting('invalid', authHeader)
    ).rejects.toBeInstanceOf(AccountSettingsApiError)
  })

  it('wraps invalid JSON responses as account settings errors', async () => {
    respondWith(new Response('{not-json', { status: 200 }))

    await expect(
      getAccountSetting('invalid-json', authHeader)
    ).rejects.toBeInstanceOf(AccountSettingsApiError)
  })

  it('writes a Cloud setting through the existing relative API path', async () => {
    respondWith(new Response(JSON.stringify({ value: true }), { status: 200 }))

    await setAccountSetting('Comfy.Agent Consent', true, authHeader)

    expect(fetchApi).toHaveBeenCalledWith('/settings/Comfy.Agent%20Consent', {
      method: 'POST',
      body: 'true'
    })
    expect(fetchWithUnifiedRemint).not.toHaveBeenCalled()
  })

  it('rejects unsuccessful writes', async () => {
    respondWith(new Response(null, { status: 500 }))

    await expect(
      setAccountSetting('consent', true, authHeader)
    ).rejects.toMatchObject({ status: 500 })
  })

  it('reads a Desktop or Local setting from the remote account API', async () => {
    distribution.isCloud = false
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: true }), { status: 200 })
    )

    await expect(getAccountSetting('consent', authHeader)).resolves.toBe(true)
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/settings/consent',
      { headers: authHeader },
      false
    )
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('writes a Desktop or Local setting to the remote account API', async () => {
    distribution.isCloud = false
    fetchWithUnifiedRemint.mockResolvedValueOnce(new Response(null))

    await setAccountSetting('consent', true, authHeader)
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/settings/consent',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer account-token',
          'Content-Type': 'application/json'
        },
        body: 'true'
      },
      false
    )
    expect(fetchApi).not.toHaveBeenCalled()
  })
})
