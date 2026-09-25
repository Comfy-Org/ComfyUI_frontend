import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'

const REPLAY_KEY = 'Comfy.OnboardingReplay'

interface ReplayRequest {
  ownerId: string
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
    typeof value.firstRun === 'boolean' &&
    'ownerId' in value &&
    typeof value.ownerId === 'string'
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

function readReplayRequest(
  ownerId: string | undefined
): ReplayRequest | undefined {
  if (ownerId === undefined) return
  try {
    const stored = sessionStorage.getItem(REPLAY_KEY)
    if (stored === null) return
    const request: unknown = JSON.parse(stored)
    if (!isReplayRequest(request) || request.ownerId !== ownerId) {
      sessionStorage.removeItem(REPLAY_KEY)
      return
    }
    return request
  } catch (error) {
    reportStorageError(error, 'reading')
  }
}

function consumeReplayRequest(
  gate: 'survey' | 'firstRun',
  ownerId: string | undefined
): void {
  const request = readReplayRequest(ownerId)
  if (!request) return
  const next = { ...request, [gate]: false }
  try {
    sessionStorage.setItem(REPLAY_KEY, JSON.stringify(next))
  } catch (error) {
    reportStorageError(error, 'clearing')
  }
}

export function isSurveyReplayRequested(ownerId: string | undefined): boolean {
  return readReplayRequest(ownerId)?.survey === true
}

export function consumeSurveyReplayRequest(ownerId: string | undefined): void {
  consumeReplayRequest('survey', ownerId)
}

export function restoreSurveyReplayRequest(ownerId: string | undefined): void {
  const current = readReplayRequest(ownerId)
  if (!current) return
  writeReplayRequest({
    ownerId: current.ownerId,
    survey: true,
    firstRun: current.firstRun
  })
}

export function isFirstRunReplayRequested(
  ownerId: string | undefined
): boolean {
  return readReplayRequest(ownerId)?.firstRun === true
}

export function consumeFirstRunReplayRequest(
  ownerId: string | undefined
): void {
  consumeReplayRequest('firstRun', ownerId)
}

export function requestOnboardingReplay(ownerId: string | undefined): boolean {
  if (!isCloud) return true
  if (ownerId === undefined) return false
  return writeReplayRequest({
    ownerId,
    survey: true,
    firstRun: true
  })
}

export function clearOnboardingReplay(ownerId?: string): void {
  try {
    sessionStorage.removeItem(REPLAY_KEY)
  } catch (error) {
    reportStorageError(error, 'clearing')
    if (ownerId) writeReplayRequest({ ownerId, survey: false, firstRun: false })
  }
}
