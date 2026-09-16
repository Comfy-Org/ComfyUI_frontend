import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

import { ASSERTION_FAILURE_PREFIX, hasRumAssertReporter } from '@/base/assert'

import { REPORTED_ERROR_PREFIX } from './reportError'

const RUM_NOISE_HOSTS = [
  'facebook.com',
  'px.ads.linkedin.com',
  'browser-intake-us5-datadoghq.com',
  'e2.sy-d.io',
  'google-analytics.com',
  'googletagmanager.com'
]

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

/**
 * `reportError` logs every report, so its console line arrives here as a
 * second, untagged copy of an error RUM already has.
 */
function isConsoleEchoOfReportedError(event: RumErrorEvent): boolean {
  return (
    event.error.source === 'console' &&
    event.error.message.startsWith(REPORTED_ERROR_PREFIX)
  )
}

function isNetworkNoiseFromKnownHost(message: string): boolean {
  const isNetworkNoise =
    message.includes('csp_violation') || message.includes('Failed to fetch')
  return (
    isNetworkNoise && RUM_NOISE_HOSTS.some((host) => message.includes(host))
  )
}

/**
 * A CSP violation is the browser correctly enforcing our policy, not a
 * first-party bug — the bulk are third-party ad/tracking scripts (e.g. a `blob`
 * `script-src` violation injected by an ad pixel) whose blocked URI carries no
 * host to match against `RUM_NOISE_HOSTS`. Drop those, but scope the rule to the
 * violation's ORIGIN, never its directive: a violation traced to first-party
 * code is a genuine bug to fix in the CSP, so it must survive this filter. The
 * SDK builds the report's stack from the offending `sourceFile`, so the shared
 * origin classifier separates the two (an unattributable violation has no stack
 * and classifies as third party).
 */
function isThirdPartyCspViolation(event: RumErrorEvent): boolean {
  return (
    event.error.message.includes('csp_violation') &&
    classifyRumErrorOrigin(event.error.stack).origin === 'third_party'
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  if (isConsoleEchoOfReportedError(event)) return false

  const message = event.error.message
  if (message.startsWith('intervention:')) return false
  if (message.includes('ResizeObserver loop')) return false

  if (isNetworkNoiseFromKnownHost(message)) return false
  if (isThirdPartyCspViolation(event)) return false

  return true
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
