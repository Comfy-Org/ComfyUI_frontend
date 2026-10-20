import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

const DECLINE_WRITE_FAILURE = {
  surface: 'agent',
  errorType: 'agent_consent_decline_write_failure'
} as const

export async function recordConsentOfferDeclined(): Promise<void> {
  try {
    const response = await api.storeSetting(
      AGENT_CONSENT_OFFER_DECLINED_SETTING_ID,
      true,
      { keepalive: true }
    )
    if (!response.ok) {
      reportError(
        new Error(`Failed to store consent refusal (${response.status})`),
        DECLINE_WRITE_FAILURE
      )
      return
    }
  } catch (error) {
    reportError(error, DECLINE_WRITE_FAILURE)
    return
  }

  useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID] =
    true
}
