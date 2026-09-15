import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import {
  clearOnboardingReplay,
  requestOnboardingReplay
} from './onboardingReplay'
import { TOUR_SEEN_SETTING } from './onboardingTours'

class OnboardingReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingReplayError'
  }
}

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
export async function resetOnboardingState(): Promise<void> {
  // Armed first because it is the reversible half: the server write cannot be
  // taken back, so failing after it would clear the seen-list while reporting
  // that nothing happened.
  if (!requestOnboardingReplay()) {
    throw new OnboardingReplayError(
      'Session storage is unavailable, so the onboarding replay cannot be requested'
    )
  }

  // `settingStore.set` resolves even when the server rejects the write, since
  // nothing between it and `fetch` inspects the status. Going through the API
  // is what makes a failed reset observable; safe here because the setting is
  // `type: 'hidden'` with no `onChange`.
  let response: Response
  try {
    response = await api.storeSetting(TOUR_SEEN_SETTING, [])
  } catch (error) {
    // A timeout or a dead connection rejects rather than returning a status,
    // and would otherwise leave the replay armed after reporting failure.
    clearOnboardingReplay()
    throw error
  }

  if (!response.ok) {
    clearOnboardingReplay()
    throw new OnboardingReplayError(
      `Failed to clear seen onboarding tours: ${response.statusText}`
    )
  }

  // The write above leaves the store's copy stale, and `markTourSeen` is a
  // read-modify-write off it: a reset the user then declines to reload away
  // from would be undone by the next coachmark dismissal. Repeating the write
  // through the store is what refreshes that copy in its own write ordering;
  // the redundant request is idempotent, and the server is already correct if
  // it fails.
  await useSettingStore().set(TOUR_SEEN_SETTING, [])
}
