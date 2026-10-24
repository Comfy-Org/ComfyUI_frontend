import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

import { isRumErrorNoise } from '@comfyorg/shared-frontend-utils/telemetry'

import { ASSERTION_FAILURE_PREFIX, hasRumAssertReporter } from '@/base/assert'

import {
  EXTENSION_FAILURES_TRUNCATED_FIELD,
  EXTENSION_LOAD_ERROR_TYPE,
  getExtensionFailureSignals
} from './extensionLoadTelemetry'

const FIRST_PARTY_EXTENSION_FOLDERS = new Set(['cloud', 'core'])

const FIREBASE_PENDING_PROMISE_ASSERTION =
  'INTERNAL ASSERTION FAILED: Pending promise was never set'
const FIREBASE_PENDING_PROMISE_FINGERPRINT = 'firebase-auth-pending-promise'

type RumErrorOrigin =
  | { origin: 'first_party' }
  | { origin: 'extension'; extension: string }
  | { origin: 'third_party' }

export function classifyRumErrorOrigin(stack?: string): RumErrorOrigin {
  if (!stack) return { origin: 'third_party' }

  for (const line of stack.split('\n')) {
    const extensionFolder = /\/extensions\/([^/?#]+)\//.exec(line)?.[1]
    if (extensionFolder) {
      return FIRST_PARTY_EXTENSION_FOLDERS.has(extensionFolder)
        ? { origin: 'first_party' }
        : { origin: 'extension', extension: extensionFolder }
    }

    if (line.includes('/assets/')) return { origin: 'first_party' }
  }

  return { origin: 'third_party' }
}

function fingerprintFirebasePendingPromise(event: RumErrorEvent): void {
  if (event.error.message.endsWith(FIREBASE_PENDING_PROMISE_ASSERTION)) {
    event.error.fingerprint = FIREBASE_PENDING_PROMISE_FINGERPRINT
  }
}

/**
 * RUM collects `console.error` on its own, so a reported assertion arrives
 * twice — untagged from the console, and tagged.
 */
function isConsoleEchoOfReportedAssertion(event: RumErrorEvent): boolean {
  return (
    hasRumAssertReporter() &&
    event.error.source === 'console' &&
    event.error.message.startsWith(ASSERTION_FAILURE_PREFIX)
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  return !isRumErrorNoise(event.error)
}

function tagRumErrorOrigin(event: RumErrorEvent): void {
  try {
    const context = event.context ?? {}
    const errorOrigin = isExtensionLoadReport(context)
      ? classifyExtensionLoadReport(context, event.error.stack)
      : classifyRumErrorOrigin(event.error.stack)
    const existingErrorContext = event.context?.error
    const errorContext =
      typeof existingErrorContext === 'object' && existingErrorContext !== null
        ? existingErrorContext
        : {}

    event.context = {
      ...event.context,
      error: { ...errorContext, ...errorOrigin }
    }
  } catch {
    return
  }
}

function getExtensionFailureOrigins(
  context: Record<string, unknown>
): RumErrorOrigin[] {
  const failures = context.failures
  if (!Array.isArray(failures)) return []

  return failures.map((failure: unknown) => {
    const signals = getExtensionFailureSignals(failure)
    const origins = signals.map(classifyRumErrorOrigin)
    return (
      origins.find((origin) => origin.origin === 'extension') ??
      origins.find((origin) => origin.origin === 'first_party') ?? {
        origin: 'third_party'
      }
    )
  })
}

function classifyExtensionLoadReport(
  context: Record<string, unknown>,
  stack?: string
): RumErrorOrigin {
  if (context[EXTENSION_FAILURES_TRUNCATED_FIELD] === true) {
    return { origin: 'first_party' }
  }

  const origins = getExtensionFailureOrigins(context)
  const extensionOrigin = origins.find(
    (origin): origin is Extract<RumErrorOrigin, { origin: 'extension' }> =>
      origin.origin === 'extension'
  )

  if (
    extensionOrigin &&
    origins.every(
      (origin) =>
        origin.origin === 'extension' &&
        origin.extension === extensionOrigin.extension
    )
  ) {
    return extensionOrigin
  }

  return origins.length > 0
    ? { origin: 'first_party' }
    : classifyRumErrorOrigin(stack)
}

function isExtensionLoadReport(context: Record<string, unknown>): boolean {
  return context.error_type === EXTENSION_LOAD_ERROR_TYPE
}

export const rumBeforeSend: RumBeforeSend = (event) => {
  if (!shouldKeepRumEvent(event)) return false
  if (event.type === 'error') {
    fingerprintFirebasePendingPromise(event)
    tagRumErrorOrigin(event)
  }
  return true
}
