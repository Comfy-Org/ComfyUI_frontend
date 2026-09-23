import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import {
  clearOnboardingReplay,
  requestOnboardingReplay
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

export type OnboardingResetResult =
  | { status: 'ready' }
  | { status: 'failed'; cause: unknown }

export async function resetOnboardingState(): Promise<OnboardingResetResult> {
  if (!requestOnboardingReplay()) {
    return {
      status: 'failed',
      cause:
        'Session storage is unavailable, so the onboarding replay cannot be requested'
    }
  }

  let response: Response
  try {
    response = await api.storeSetting(TOUR_SEEN_SETTING, [])
  } catch (cause) {
    clearOnboardingReplay()
    return { status: 'failed', cause }
  }

  if (!response.ok) {
    clearOnboardingReplay()
    return {
      status: 'failed',
      cause: `Failed to clear seen onboarding tours: ${response.statusText}`
    }
  }

  try {
    await useSettingStore().applySettingLocally(TOUR_SEEN_SETTING, [])
  } catch (error) {
    reportError(error, {
      errorType: 'error_applying_onboarding_reset_locally'
    })
  }
  return { status: 'ready' }
}
