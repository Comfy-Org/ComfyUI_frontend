import type { ErrorEvent, EventHint } from '@sentry/vue'

import { isThirdPartyErrorNoise } from '@comfyorg/shared-frontend-utils/telemetry'

import { isAbortError } from '@/utils/typeGuardUtil'

function messageFrom(value: unknown): string | undefined {
  try {
    if (typeof value === 'string') return value
    if (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      typeof value.message === 'string'
    )
      return value.message
    return undefined
  } catch {
    return undefined
  }
}

function exceptionValueFrom(value: unknown): string[] {
  try {
    if (typeof value !== 'object' || value === null || !('value' in value))
      return []
    return typeof value.value === 'string' ? [value.value] : []
  } catch {
    return []
  }
}

function exceptionTypeFrom(value: unknown): unknown {
  try {
    return typeof value === 'object' && value !== null && 'type' in value
      ? value.type
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Drops a browser-extension messaging failure that the app never emits, and
 * events whose thrown error is an AbortError. That also drops timeouts
 * implemented as a bare `controller.abort()`; the noise reduction is worth it.
 * Chained causes are ignored so a first-party error wrapping one is kept.
 */
export function sentryThirdPartyErrorFilter(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  try {
    if (
      isAbortError(hint.originalException) ||
      exceptionTypeFrom(event.exception?.values?.at(-1)) === 'AbortError'
    )
      return null
    if (
      isThirdPartyErrorNoise(messageFrom(hint.originalException)) ||
      isThirdPartyErrorNoise(event.message)
    )
      return null
    const exceptionMessages =
      event.exception?.values?.flatMap(exceptionValueFrom) ?? []
    return exceptionMessages.length > 0 &&
      exceptionMessages.every(isThirdPartyErrorNoise)
      ? null
      : event
  } catch {
    return event
  }
}
