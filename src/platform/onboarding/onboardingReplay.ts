import { api } from '@/scripts/api'

import { TOUR_SEEN_SETTING } from './onboardingTours'

/**
 * The gates are served at different moments — the survey during routing, the
 * Getting Started screen once the canvas boots — so each is spent by whoever
 * serves it. One shared flag would let the first consumer swallow the replay
 * before the second ran.
 */
const SURVEY_KEY = 'Comfy.OnboardingReplay.Survey'
const FIRST_RUN_KEY = 'Comfy.OnboardingReplay.FirstRun'

class OnboardingReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingReplayError'
  }
}

function requestReplay(key: string): boolean {
  try {
    sessionStorage.setItem(key, 'true')
    return true
  } catch {
    console.warn(`[onboarding] Failed to record the replay request ${key}`)
    return false
  }
}

function isReplayRequested(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * Falls back to overwriting the marker, because leaving a served request
 * standing re-serves the gate forever: the survey would bounce a user back to
 * a form they already submitted.
 */
function consumeReplayRequest(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    try {
      sessionStorage.setItem(key, 'false')
    } catch {
      console.warn(`[onboarding] Failed to clear the replay request ${key}`)
    }
  }
}

export function isSurveyReplayRequested(): boolean {
  return isReplayRequested(SURVEY_KEY)
}

export function consumeSurveyReplayRequest(): void {
  consumeReplayRequest(SURVEY_KEY)
}

export function isFirstRunReplayRequested(): boolean {
  return isReplayRequested(FIRST_RUN_KEY)
}

export function consumeFirstRunReplayRequest(): void {
  consumeReplayRequest(FIRST_RUN_KEY)
}

/**
 * Asks the next boot to serve onboarding to an account that has already been
 * through it. Session-scoped so a request cannot outlive the tab that made it,
 * and each gate spends its own request, so one click replays onboarding once.
 *
 * Returns false when session storage rejected a write, having cleared whatever
 * did land so a half-armed replay cannot serve one gate and not the other.
 */
export function requestOnboardingReplay(): boolean {
  if (!requestReplay(SURVEY_KEY)) return false
  if (!requestReplay(FIRST_RUN_KEY)) {
    consumeReplayRequest(SURVEY_KEY)
    return false
  }
  return true
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
 * session by {@link isSurveyReplayRequested} and
 * {@link isFirstRunReplayRequested} instead.
 *
 * Every gate is read during startup, so the caller has to reload for any of
 * this to take effect.
 */
export async function resetOnboardingState(): Promise<void> {
  // `settingStore.set` resolves even when the server rejects the write, since
  // nothing between it and `fetch` inspects the status. Going through the API
  // is what makes a failed reset observable; safe here because the setting is
  // `type: 'hidden'` with no `onChange`, and the caller reloads, so the
  // store's copy is rebuilt from the server either way.
  const response = await api.storeSetting(TOUR_SEEN_SETTING, [])
  if (!response.ok) {
    throw new OnboardingReplayError(
      `Failed to clear seen onboarding tours: ${response.statusText}`
    )
  }

  // Last, so that until it lands the reset above stays recoverable by retrying.
  if (!requestOnboardingReplay()) {
    throw new OnboardingReplayError(
      'Session storage is unavailable, so the onboarding replay cannot be requested'
    )
  }
}
