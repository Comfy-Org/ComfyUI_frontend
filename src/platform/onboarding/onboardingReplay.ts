import type { Settings } from '@/schemas/apiSchema'
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

export class OnboardingReplayError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
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

function consumeReplayRequest(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    console.warn(`[onboarding] Failed to clear the replay request ${key}`)
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
 * Returns false when session storage rejected the write, which leaves the
 * replay unrecorded and therefore unable to happen.
 */
export function requestOnboardingReplay(): boolean {
  const survey = requestReplay(SURVEY_KEY)
  const firstRun = requestReplay(FIRST_RUN_KEY)
  return survey && firstRun
}

/**
 * `settingStore.set` resolves even when the server rejects the write, because
 * nothing between it and `fetch` inspects the response status. Going through
 * the API directly is what makes a failed reset observable. Safe for these two
 * keys specifically: both are `type: 'hidden'` with no `onChange`, and the
 * caller reloads, so the store's in-memory copy is rebuilt from the server
 * either way.
 */
async function storeSettingOrThrow<K extends keyof Settings>(
  id: K,
  value: Settings[K]
): Promise<void> {
  const response = await api.storeSetting(id, value)
  if (!response.ok) {
    throw new OnboardingReplayError(
      `Failed to store ${id}: ${response.statusText}`,
      response.status
    )
  }
}

/**
 * Re-opens the gates that hide onboarding from an account that has already
 * been through it, leaving everything the user authored intact.
 *
 * Nothing the user produced is rewritten. The signup survey's stored answers
 * are left alone — `/api/settings` merges only at the top level, so writing
 * that key at all would overwrite them — and the survey is re-served by
 * {@link isSurveyReplayRequested} overriding its gate for this session
 * instead. Local draft history is read by the Getting Started screen's
 * `isNewUser` check but likewise never cleared: it is the user's work rather
 * than onboarding state, so {@link isFirstRunReplayRequested} stands in for
 * it.
 *
 * That leaves the two pieces of onboarding bookkeeping this flow genuinely
 * owns. Every gate is read during startup, so the caller has to reload for any
 * of it to take effect.
 */
export async function resetOnboardingState(): Promise<void> {
  await storeSettingOrThrow('Comfy.TutorialCompleted', false)
  await storeSettingOrThrow(TOUR_SEEN_SETTING, [])

  // Last, so that until it lands the reset above stays inert, not partial.
  if (!requestOnboardingReplay()) {
    throw new OnboardingReplayError(
      'Session storage is unavailable, so the onboarding replay cannot be requested'
    )
  }
}
