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

const MINIFIED_MESSAGE = /^[A-Za-z0-9_$]{1,3}$/

function exceptionFramesFrom(value: unknown): string[] {
  try {
    if (typeof value !== 'object' || value === null || !('stacktrace' in value))
      return []
    const frames = (value.stacktrace as { frames?: unknown }).frames
    if (!Array.isArray(frames)) return []
    return frames.flatMap((frame: unknown) =>
      typeof frame === 'object' &&
      frame !== null &&
      'filename' in frame &&
      typeof frame.filename === 'string'
        ? [frame.filename]
        : []
    )
  } catch {
    return []
  }
}

function isInjectedScriptNoise(event: ErrorEvent): boolean {
  const exceptions = event.exception?.values ?? []
  const messages = exceptions.flatMap(exceptionValueFrom)
  return (
    messages.length > 0 &&
    messages.length === exceptions.length &&
    messages.every((message) => MINIFIED_MESSAGE.test(message)) &&
    !exceptions
      .flatMap(exceptionFramesFrom)
      .some((filename) => filename.includes('/assets/'))
  )
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
    if (isInjectedScriptNoise(event)) return null
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
