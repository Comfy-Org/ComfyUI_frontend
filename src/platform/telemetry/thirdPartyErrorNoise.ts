import type { ErrorEvent, EventHint } from '@sentry/vue'

import { isThirdPartyErrorNoise } from '@comfyorg/shared-frontend-utils/telemetry'

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

function isAbortErrorLike(value: unknown): boolean {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      value.name === 'AbortError'
    )
  } catch {
    return false
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
 * AbortErrors, which only mean a request was cancelled on purpose.
 */
export function sentryThirdPartyErrorFilter(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  try {
    if (
      isAbortErrorLike(hint.originalException) ||
      event.exception?.values?.some(
        (value) => exceptionTypeFrom(value) === 'AbortError'
      )
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
