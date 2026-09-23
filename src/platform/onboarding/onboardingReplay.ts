import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'

const REPLAY_KEY = 'Comfy.OnboardingReplay'

interface ReplayRequest {
  survey: boolean
  firstRun: boolean
}

function reportStorageError(
  error: unknown,
  operation: 'writing' | 'reading' | 'clearing'
) {
  reportError(error, {
    errorType: `error_${operation}_onboarding_replay_request`
  })
}

function isReplayRequest(value: unknown): value is ReplayRequest {
  if (typeof value !== 'object' || value === null) return false
  return (
    'survey' in value &&
    typeof value.survey === 'boolean' &&
    'firstRun' in value &&
    typeof value.firstRun === 'boolean'
  )
}

function writeReplayRequest(request: ReplayRequest): boolean {
  try {
    sessionStorage.setItem(REPLAY_KEY, JSON.stringify(request))
    return true
  } catch (error) {
    reportStorageError(error, 'writing')
    return false
  }
}

function readReplayRequest(): ReplayRequest | undefined {
  try {
    const stored = sessionStorage.getItem(REPLAY_KEY)
    if (stored === null) return
    const request: unknown = JSON.parse(stored)
    if (!isReplayRequest(request)) {
      sessionStorage.removeItem(REPLAY_KEY)
      return
    }
    return request
  } catch (error) {
    reportStorageError(error, 'reading')
  }
}

function consumeReplayRequest(gate: 'survey' | 'firstRun'): void {
  const request = readReplayRequest()
  if (!request) return
  const next = { ...request, [gate]: false }
  try {
    sessionStorage.setItem(REPLAY_KEY, JSON.stringify(next))
  } catch (error) {
    reportStorageError(error, 'clearing')
  }
}

export function isSurveyReplayRequested(): boolean {
  return readReplayRequest()?.survey === true
}

export function consumeSurveyReplayRequest(): void {
  consumeReplayRequest('survey')
}

export function restoreSurveyReplayRequest(): void {
  const current = readReplayRequest()
  writeReplayRequest({
    survey: true,
    firstRun: current?.firstRun ?? false
  })
}

export function isFirstRunReplayRequested(): boolean {
  return readReplayRequest()?.firstRun === true
}

export function consumeFirstRunReplayRequest(): void {
  consumeReplayRequest('firstRun')
}

/**
 * Asks eligible cloud onboarding gates to serve an account again. The gates
 * spend their parts of one session-scoped request independently.
 */
export function requestOnboardingReplay(): boolean {
  // Both gates these arm are cloud-only. Off cloud the coachmark tours are the
  // whole of onboarding, so clearing their seen-list is the entire replay and
  // an armed request would only sit unserved for the life of the tab.
  if (!isCloud) return true
  return writeReplayRequest({
    survey: true,
    firstRun: true
  })
}

export function clearOnboardingReplay(): void {
  try {
    sessionStorage.removeItem(REPLAY_KEY)
  } catch (error) {
    reportStorageError(error, 'clearing')
    writeReplayRequest({ survey: false, firstRun: false })
  }
}
