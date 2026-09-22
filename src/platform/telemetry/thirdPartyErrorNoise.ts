const EXTENSION_TAB_NOT_FOUND_MESSAGE =
  'Invalid call to runtime.sendMessage(). Tab not found.'

type SentryEventLike = {
  message?: string
  exception?: { values?: Array<{ value?: string }> }
}

type SentryHintLike = { originalException?: unknown }

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
export function sentryThirdPartyErrorFilter<T extends SentryEventLike>(
  event: T,
  hint: SentryHintLike
): T | null {
  const messages = [
    messageFrom(hint.originalException),
    event.message,
    ...(event.exception?.values?.map(({ value }) => value) ?? [])
  ]
  return messages.some(isThirdPartyErrorNoise) ? null : event
}
