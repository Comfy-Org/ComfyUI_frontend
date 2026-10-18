import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

export function consentOfferDeclined(): boolean {
  return useSettingStore().get(AGENT_CONSENT_OFFER_DECLINED_SETTING_ID)
}

export async function recordConsentOfferDeclined(): Promise<boolean> {
  try {
    const response = await api.storeSetting(
      AGENT_CONSENT_OFFER_DECLINED_SETTING_ID,
      true,
      { keepalive: true }
    )
    if (!response.ok) {
      reportError(
        new Error(`Failed to store consent refusal (${response.status})`),
        {
          surface: 'agent',
          errorType: 'agent_consent_decline_write_failure'
        }
      )
      return false
    }
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_consent_decline_write_failure'
    })
    return false
  }

  useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID] =
    true
  return true
}
