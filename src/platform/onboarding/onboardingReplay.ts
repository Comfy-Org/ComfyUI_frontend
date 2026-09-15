import { resetSurvey } from '@/platform/cloud/onboarding/auth'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'

import { TOUR_SEEN_SETTING } from './onboardingTours'

const REPLAY_REQUESTED_KEY = 'Comfy.OnboardingReplayRequested'

/**
 * Asks the next boot to treat this account as a first-time user.
 *
 * Session-scoped so the request cannot outlive the tab that made it, and spent
 * by the boot that reads it: one request replays onboarding once, and a later
 * reload sees the account's real state again.
 */
export function requestOnboardingReplay(): void {
  try {
    sessionStorage.setItem(REPLAY_REQUESTED_KEY, 'true')
  } catch {
    console.warn('[onboarding] Failed to record the onboarding replay request')
  }
}

export function isOnboardingReplayRequested(): boolean {
  try {
    return sessionStorage.getItem(REPLAY_REQUESTED_KEY) === 'true'
  } catch {
    return false
  }
}

export function consumeOnboardingReplayRequest(): void {
  try {
    sessionStorage.removeItem(REPLAY_REQUESTED_KEY)
  } catch {
    console.warn('[onboarding] Failed to clear the onboarding replay request')
  }
}

/**
 * Re-opens every gate that hides onboarding from an account that has already
 * been through it, leaving the user's workflows untouched.
 *
 * The gates are independent and stored separately: the cloud signup survey is
 * a bare key in the cloud user's settings blob, the Getting Started screen is
 * `Comfy.TutorialCompleted`, and the coachmark tours are a seen list. The
 * Getting Started screen additionally requires `isNewUser`, which reads local
 * draft history — hence the replay request rather than clearing that history,
 * which is the user's work rather than onboarding state.
 *
 * Every gate is read during startup, so the caller has to reload for this to
 * take effect.
 */
export async function resetOnboardingState(): Promise<void> {
  const settingStore = useSettingStore()

  await settingStore.set('Comfy.TutorialCompleted', false)
  await settingStore.set(TOUR_SEEN_SETTING, [])
  if (isCloud) {
    await resetSurvey()
  }

  requestOnboardingReplay()
}
