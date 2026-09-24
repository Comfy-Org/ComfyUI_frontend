import type { ErrorEvent, EventHint } from '@sentry/vue'

const EXTENSION_TAB_NOT_FOUND_MESSAGE =
  'Invalid call to runtime.sendMessage(). Tab not found.'

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

export function isThirdPartyErrorNoise(message?: string): boolean {
  if (!message) return false
  const index = message.indexOf(EXTENSION_TAB_NOT_FOUND_MESSAGE)
  if (index < 0) return false
  const prefix = message.slice(0, index)
  return /^(?:Unhandled promise rejection:\s*)?(?:Error:\s*)?$/.test(prefix)
}

/** Drops a browser-extension messaging failure that the app never emits. */
export function sentryThirdPartyErrorFilter(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  try {
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
