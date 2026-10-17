import type {
  RumActionEvent,
  RumBeforeSend,
  RumErrorEvent,
  RumLongTaskEvent,
  RumViewEvent
} from '@datadog/browser-rum'

import {
  isRumErrorNoise,
  namesRumNoiseHost
} from '@comfyorg/shared-frontend-utils/telemetry'

import { ASSERTION_FAILURE_PREFIX, hasRumAssertReporter } from '@/base/assert'

import {
  redactTelemetryUrls,
  redactTelemetryValues
} from './redactTelemetryUrls'

const FIRST_PARTY_EXTENSION_FOLDERS = new Set(['cloud', 'core'])

const FIREBASE_PENDING_PROMISE_ASSERTION =
  'INTERNAL ASSERTION FAILED: Pending promise was never set'
const FIREBASE_PENDING_PROMISE_FINGERPRINT = 'firebase-auth-pending-promise'

type RumErrorOrigin =
  | { origin: 'first_party' }
  | { origin: 'extension'; extension: string }
  | { origin: 'third_party' }

/** V8 (`at fn (url:1:2)`) and SpiderMonkey (`fn@url:1:2`) frame shapes. */
function isStackFrameLine(line: string): boolean {
  return /^\s*at\s/.test(line) || /@https?:\/\//.test(line)
}

function stackFrameLines(stack?: string): string[] {
  return stack?.split('\n').filter(isStackFrameLine) ?? []
}

export function classifyRumErrorOrigin(stack?: string): RumErrorOrigin {
  if (!stack) return { origin: 'third_party' }

  // Only real stack frames decide origin. A report's `stack` is prefixed by
  // its message header (`csp_violation: '<blockedURI>' blocked by ...`), so
  // scanning every line lets a vendor- or attacker-controlled blocked URI
  // such as `https://cdn.vendor.com/assets/pixel.js` read as first party, or
  // one containing `/extensions/<name>/` be attributed to an extension that
  // does not exist.
  for (const line of stackFrameLines(stack)) {
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

/** Our own code tripping the CSP is a defect even when the blocked host is a tracker. */
function isFirstPartyCspViolation(event: RumErrorEvent): boolean {
  const { message, stack } = event.error
  return (
    message.startsWith('csp_violation:') &&
    !stackFrameLines(stack).some(namesRumNoiseHost) &&
    classifyRumErrorOrigin(stack).origin === 'first_party'
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  if (hasUnmodifiableUrlMetadata(event)) return false
  if (isFirstPartyCspViolation(event)) return true
  return !isRumErrorNoise(event.error)
}

function hasUnmodifiableUrlMetadata(event: RumErrorEvent): boolean {
  const values = [
    event.error.type,
    ...(event.error.causes ?? []).flatMap((cause) => [
      cause.type,
      cause.message,
      cause.stack
    ])
  ]
  return values.some(
    (value) => typeof value === 'string' && redactTelemetryUrls(value) !== value
  )
}

function tagRumErrorOrigin(event: RumErrorEvent): void {
  try {
    const errorOrigin = classifyRumErrorOrigin(event.error.stack)
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

function redactRumView(event: Parameters<RumBeforeSend>[0]): void {
  event.view.url = redactTelemetryUrls(event.view.url)
  if (event.view.referrer) {
    event.view.referrer = redactTelemetryUrls(event.view.referrer)
  }
}

function redactRumAction(event: RumActionEvent): void {
  if (event.action.target?.name) {
    event.action.target.name = redactTelemetryUrls(event.action.target.name)
  }
}

function redactRumLongTask(event: RumLongTaskEvent): void {
  for (const script of event.long_task.scripts ?? []) {
    if (script.source_url) {
      script.source_url = redactTelemetryUrls(script.source_url)
    }
    // A `classic-script` invoker is the script's own `src`, query string included.
    if (script.invoker) {
      script.invoker = redactTelemetryUrls(script.invoker)
    }
  }
}

function redactRumViewPerformance(event: RumViewEvent): void {
  if (event.view.performance?.lcp?.resource_url) {
    event.view.performance.lcp.resource_url = redactTelemetryUrls(
      event.view.performance.lcp.resource_url
    )
  }
}

export const rumBeforeSend: RumBeforeSend = (event) => {
  if (!shouldKeepRumEvent(event)) return false
  if (event.type === 'resource') {
    event.resource.url = redactTelemetryUrls(event.resource.url)
  }
  if (event.type === 'error') {
    fingerprintFirebasePendingPromise(event)
    tagRumErrorOrigin(event)
    event.error.message = redactTelemetryUrls(event.error.message)
    if (event.error.stack) {
      event.error.stack = redactTelemetryUrls(event.error.stack)
    }
    if (event.error.handling_stack) {
      event.error.handling_stack = redactTelemetryUrls(
        event.error.handling_stack
      )
    }
    if (event.error.resource?.url) {
      event.error.resource.url = redactTelemetryUrls(event.error.resource.url)
    }
  }
  redactRumView(event)
  if (event.type === 'action') redactRumAction(event)
  if (event.type === 'long_task') redactRumLongTask(event)
  if (event.type === 'view') redactRumViewPerformance(event)
  event.context = redactTelemetryValues(event.context) ?? {}
  return true
}
