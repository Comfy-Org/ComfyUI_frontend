import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import {
  consentOfferDeclined,
  recordConsentOfferDeclined
} from './consentOfferDeclined'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { storeSetting: vi.fn() }
}))
vi.mock(import('@/platform/telemetry/reportError'))

describe('recordConsentOfferDeclined', () => {
  beforeEach(() => {
    useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID] =
      false
  })

  it('reads the loaded account preference synchronously', () => {
    expect(consentOfferDeclined()).toBe(false)

    useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID] =
      true

    expect(consentOfferDeclined()).toBe(true)
  })

  it('persists the refusal and updates the loaded setting', async () => {
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())

    await expect(recordConsentOfferDeclined()).resolves.toBe(true)

    expect(api.storeSetting).toHaveBeenCalledExactlyOnceWith(
      AGENT_CONSENT_OFFER_DECLINED_SETTING_ID,
      true,
      { keepalive: true }
    )
    expect(
      useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID]
    ).toBe(true)
  })

  it('reports a failed request and leaves the setting retryable', async () => {
    const error = new Error('offline')
    vi.mocked(api.storeSetting).mockRejectedValue(error)

    await expect(recordConsentOfferDeclined()).resolves.toBe(false)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'agent',
      errorType: 'agent_consent_decline_write_failure'
    })
    expect(
      useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID]
    ).toBe(false)
  })

  it('reports an unsuccessful response and leaves the setting retryable', async () => {
    vi.mocked(api.storeSetting).mockResolvedValue(
      new Response(null, { status: 500 })
    )

    await expect(recordConsentOfferDeclined()).resolves.toBe(false)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_consent_decline_write_failure'
    })
    expect(
      useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID]
    ).toBe(false)
  })
})
