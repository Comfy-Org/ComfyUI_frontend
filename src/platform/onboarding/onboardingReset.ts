import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

import {
  clearOnboardingReplay,
  requestOnboardingReplay
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

export type OnboardingResetResult =
  | { status: 'ready' }
  | { status: 'failed'; cause: unknown }

export async function resetOnboardingState(): Promise<OnboardingResetResult> {
  const ownerId = useAuthStore().userId
  if (isCloud && ownerId === undefined) {
    return {
      status: 'failed',
      cause:
        'No signed-in account, so the onboarding replay cannot be requested'
    }
  }
  if (!requestOnboardingReplay(ownerId)) {
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
    clearOnboardingReplay(ownerId)
    return { status: 'failed', cause }
  }

  if (!response.ok) {
    clearOnboardingReplay(ownerId)
    return {
      status: 'failed',
      cause:
        `Failed to clear seen onboarding tours: ${response.status} ${response.statusText}`.trim()
    }
  }

  useSettingStore().settingValues[TOUR_SEEN_SETTING] = []
  return { status: 'ready' }
}
