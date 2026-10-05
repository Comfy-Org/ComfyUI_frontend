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

const MINIFIED_MESSAGE = /^(?=.*[A-Za-z])[A-Za-z0-9_$]{1,3}$/
const FIRST_PARTY_PATH = /\/(?:assets|extensions)\//

function parseFrameUrl(filename: string): URL | undefined {
  try {
    return new URL(filename)
  } catch {
    return undefined
  }
}

function exceptionFrameUrlsFrom(value: unknown): URL[] | undefined {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('stacktrace' in value) ||
      typeof value.stacktrace !== 'object' ||
      value.stacktrace === null ||
      !('frames' in value.stacktrace) ||
      !Array.isArray(value.stacktrace.frames)
    )
      return []
    return value.stacktrace.frames.flatMap((frame: unknown) => {
      if (
        typeof frame !== 'object' ||
        frame === null ||
        !('filename' in frame) ||
        typeof frame.filename !== 'string'
      )
        return []
      const url = parseFrameUrl(frame.filename)
      return url ? [url] : []
    })
  } catch {
    return undefined
  }
}

function isFirstPartyFrame(url: URL, appOrigin: string): boolean {
  return url.origin === appOrigin && FIRST_PARTY_PATH.test(url.pathname)
}

function isInjectedScriptNoise(event: ErrorEvent): boolean {
  const exceptions = event.exception?.values ?? []
  const appOrigin = globalThis.location.origin
  if (exceptions.length === 0) return false
  const allMinified = exceptions.every((exception) => {
    const messages = exceptionValueFrom(exception)
    return (
      messages.length > 0 && messages.every((m) => MINIFIED_MESSAGE.test(m))
    )
  })
  if (!allMinified) return false
  const frames: URL[] = []
  for (const exception of exceptions) {
    const exceptionFrames = exceptionFrameUrlsFrom(exception)
    if (!exceptionFrames) return false
    frames.push(...exceptionFrames)
  }
  return (
    frames.length > 0 &&
    frames.every((frame) => !isFirstPartyFrame(frame, appOrigin))
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
