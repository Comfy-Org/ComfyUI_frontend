/**
 * Turns Router and model failures into something a person can act on. Each
 * value names a title and message under `darkroom.failure`; the raw detail
 * stays one click away in the tile.
 */
import type { DarkroomResponse } from './response'

export type DarkroomFailure =
  | 'blocked'
  | 'noImage'
  | 'noImageText'
  | 'signedOut'
  | 'noCredits'
  | 'rateLimit'
  | 'settings'
  | 'tooLarge'
  | 'timeout'
  | 'unavailable'
  | 'network'
  | 'stopped'
  | 'cancelledInLine'
  | 'lost'
  | 'generic'

const SAFETY = /SAFETY|PROHIBITED|BLOCK|RECITATION/i

/** Why a finished response carries no image, or nothing if it has one. */
export function failureFromResponse(
  response: DarkroomResponse
): DarkroomFailure | undefined {
  if (response.images.length) return undefined
  const finish = `${response.finishReasons.join(' ')} ${response.blockReason ?? ''}`
  if (SAFETY.test(finish)) return 'blocked'
  return response.texts.length ? 'noImageText' : 'noImage'
}

/** Router's refusal, from its status and `X-Comfy-Error-Type` bucket. */
export function failureFromStatus(
  status: number,
  errorType: string | null
): DarkroomFailure {
  if (errorType === 'insufficient_credits' || status === 402) return 'noCredits'
  if (errorType === 'content_policy_violation') return 'blocked'
  if (errorType === 'cancelled') return 'stopped'
  if (errorType === 'provider_timeout' || errorType === 'queue_timeout')
    return 'timeout'
  if (errorType === 'invalid_input') return 'settings'
  if (status === 401) return 'signedOut'
  if (status === 403 || status === 404) return 'unavailable'
  if (status === 413) return 'tooLarge'
  if (status === 429) return 'rateLimit'
  if (status === 400 || status === 422) return 'settings'
  if (status === 504) return 'timeout'
  return 'generic'
}

/** The failures a new attempt cannot fix until the account changes. */
export function needsCredits(failure: DarkroomFailure): boolean {
  return failure === 'noCredits'
}

/** A raw detail short enough to show under "Details". */
export function failureDetail(
  response: Pick<DarkroomResponse, 'texts' | 'finishReasons' | 'blockReason'>
): string {
  return [
    response.blockReason && `blockReason: ${response.blockReason}`,
    response.finishReasons.length &&
      `finishReason: ${response.finishReasons.join(', ')}`,
    response.texts.join('\n')
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 3000)
}
