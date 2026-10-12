import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

import {
  isRumErrorNoise,
  namesRumNoiseHost
} from '@comfyorg/shared-frontend-utils/telemetry'

import { ASSERTION_FAILURE_PREFIX, hasRumAssertReporter } from '@/base/assert'

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

export function classifyRumErrorOrigin(stack?: string): RumErrorOrigin {
  if (!stack) return { origin: 'third_party' }

  for (const line of stack.split('\n')) {
    // Only real stack frames decide origin. A report's `stack` is prefixed by
    // its message header (`csp_violation: '<blockedURI>' blocked by ...`), so
    // scanning every line lets a vendor- or attacker-controlled blocked URI
    // such as `https://cdn.vendor.com/assets/pixel.js` read as first party, or
    // one containing `/extensions/<name>/` be attributed to an extension that
    // does not exist.
    if (!isStackFrameLine(line)) continue

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
    !namesRumNoiseHost(stack) &&
    classifyRumErrorOrigin(stack).origin === 'first_party'
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  if (isFirstPartyCspViolation(event)) return true
  return !isRumErrorNoise(event.error)
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

export const rumBeforeSend: RumBeforeSend = (event) => {
  if (!shouldKeepRumEvent(event)) return false
  if (event.type === 'error') {
    fingerprintFirebasePendingPromise(event)
    tagRumErrorOrigin(event)
  }
  return true
}
