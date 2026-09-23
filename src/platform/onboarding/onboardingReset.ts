import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import {
  clearOnboardingReplay,
  requestOnboardingReplay
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

/**
 * Re-opens the gates that hide onboarding from an account that has already
 * been through it, leaving everything the user authored intact.
 *
 * Only the coachmark seen-list is written, and it is onboarding bookkeeping
 * this flow owns. The survey's stored answers and the local draft history that
 * the Getting Started screen reads are both left alone — they are the user's,
 * and `/api/settings` merges only at the top level, so writing the survey key
 * at all would overwrite the answers. Those two gates are re-opened for this
 * session by the replay requests instead.
 *
 * Every gate is read during startup, so the caller has to reload for any of
 * this to take effect.
 */
export type OnboardingResetResult =
  | { status: 'ready' }
  | { status: 'failed'; cause: unknown }

export async function resetOnboardingState(): Promise<OnboardingResetResult> {
  // Armed first because it is the reversible half: the server write cannot be
  // taken back, so failing after it would clear the seen-list while reporting
  // that nothing happened.
  if (!requestOnboardingReplay()) {
    return {
      status: 'failed',
      cause:
        'Session storage is unavailable, so the onboarding replay cannot be requested'
    }
  }

  // `settingStore.set` resolves even when the server rejects the write, since
  // nothing between it and `fetch` inspects the status. Going through the API
  // is what makes a failed reset observable; safe here because the setting is
  // `type: 'hidden'` with no `onChange`.
  let response: Response
  try {
    response = await api.storeSetting(TOUR_SEEN_SETTING, [])
  } catch (cause) {
    // A timeout or a dead connection rejects rather than returning a status,
    // and would otherwise leave the replay armed after reporting failure.
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
