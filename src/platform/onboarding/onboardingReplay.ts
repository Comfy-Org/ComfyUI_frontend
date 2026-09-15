import { isCloud } from '@/platform/distribution/types'

/**
 * The gates are served at different moments — the survey during routing, the
 * Getting Started screen once the canvas boots — so each is spent by whoever
 * serves it. One shared flag would let the first consumer swallow the replay
 * before the second ran.
 */
const SURVEY_KEY = 'Comfy.OnboardingReplay.Survey'
const FIRST_RUN_KEY = 'Comfy.OnboardingReplay.FirstRun'

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
  // Both gates these arm are cloud-only. Off cloud the coachmark tours are the
  // whole of onboarding, so clearing their seen-list is the entire replay and
  // an armed request would only sit unserved for the life of the tab.
  if (!isCloud) return true

  if (!requestReplay(SURVEY_KEY)) return false
  if (!requestReplay(FIRST_RUN_KEY)) {
    consumeReplayRequest(SURVEY_KEY)
    return false
  }
  return true
}

export function clearOnboardingReplay(): void {
  consumeReplayRequest(SURVEY_KEY)
  consumeReplayRequest(FIRST_RUN_KEY)
}
