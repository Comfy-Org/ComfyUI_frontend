import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AccountSettingsApiError,
  getAccountSetting,
  setAccountSetting
} from './accountSettingsApi'

vi.mock('@/config/comfyApi', () => ({
  getComfyApiBaseUrl: () => 'https://api.comfy.test'
}))

const fetchWithUnifiedRemint = vi.hoisted(() => vi.fn())
vi.mock('@/platform/auth/unified/remintRetry', () => ({
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest: () => Promise.resolve(false)
}))

const authHeader = { Authorization: 'Bearer account-token' } as const

describe('accountSettingsApi', () => {
  beforeEach(() => {
    fetchWithUnifiedRemint.mockReset()
  })

  it('reads a setting from the configured Comfy account API', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: true }), { status: 200 })
    )

    await expect(
      getAccountSetting('Comfy.Agent Consent', authHeader)
    ).resolves.toBe(true)
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/settings/Comfy.Agent%20Consent',
      { headers: authHeader },
      false
    )
  })

  it('treats a missing account setting as unset', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(null, { status: 404 })
    )

    await expect(getAccountSetting('missing', authHeader)).resolves.toBe(
      undefined
    )
  })

  it('rejects malformed successful responses', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(JSON.stringify(true), { status: 200 })
    )

    await expect(
      getAccountSetting('invalid', authHeader)
    ).rejects.toBeInstanceOf(AccountSettingsApiError)
  })

  it('writes a setting to the configured Comfy account API', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: true }), { status: 200 })
    )

    await setAccountSetting('Comfy.Agent Consent', true, authHeader)

    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      'https://api.comfy.test/api/settings/Comfy.Agent%20Consent',
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
  })

  it('rejects unsuccessful writes', async () => {
    fetchWithUnifiedRemint.mockResolvedValueOnce(
      new Response(null, { status: 500 })
    )

    await expect(
      setAccountSetting('consent', true, authHeader)
    ).rejects.toMatchObject({ status: 500 })
  })
})
