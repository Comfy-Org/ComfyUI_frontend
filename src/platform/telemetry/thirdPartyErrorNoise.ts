import type { ErrorEvent, EventHint } from '@sentry/vue'

const EXTENSION_TAB_NOT_FOUND_MESSAGE =
  'Invalid call to runtime.sendMessage(). Tab not found.'

function messageFrom(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  )
    return value.message
  return undefined
}

export function isThirdPartyErrorNoise(message?: string): boolean {
  return (
    message === EXTENSION_TAB_NOT_FOUND_MESSAGE ||
    message === `Error: ${EXTENSION_TAB_NOT_FOUND_MESSAGE}` ||
    message ===
      `Unhandled promise rejection: ${EXTENSION_TAB_NOT_FOUND_MESSAGE}`
  )
}

/** Drops a browser-extension messaging failure that the app never emits. */
export function sentryThirdPartyErrorFilter(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  if (
    isThirdPartyErrorNoise(messageFrom(hint.originalException)) ||
    isThirdPartyErrorNoise(event.message)
  )
    return null
  const exceptionMessages =
    event.exception?.values?.map(({ value }) => value) ?? []
  return exceptionMessages.length > 0 &&
    exceptionMessages.every(isThirdPartyErrorNoise)
    ? null
    : event
}
