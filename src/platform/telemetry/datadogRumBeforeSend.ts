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

/**
 * Browser/environment error messages that carry zero engineering signal.
 * Each entry is matched against the RUM `error.message` and is dropped in
 * `beforeSend`. Keep this list small and explicit — add one predicate per line
 * with a comment so every future addition is a deliberate, auditable choice.
 */
const RUM_NOISE_MESSAGE_MATCHERS: ((message: string) => boolean)[] = [
  // Benign Chrome interventions, e.g. "Ignored attempt to cancel a touchmove
  // event" and "Blocked attempt to create a WebMediaPlayer".
  (message) => message.startsWith('intervention:'),
  // Classic benign layout warning ("ResizeObserver loop completed with
  // undelivered notifications") with no actionable stack.
  (message) => message.includes('ResizeObserver loop'),
  // Failed <img> loads surface as uncaught non-Error events whose serialized
  // target is an HTMLImageElement (e.g.
  // `Uncaught {"isTrusted":true,"target":"HTMLImageElement"}`) — by far the #1
  // entry in the error stream and pure browser noise, not an app failure.
  //
  // Anchored to that `Uncaught` shape deliberately. A bare
  // `includes('HTMLImageElement')` also swallows first-party DOM TypeErrors
  // that merely NAME the interface in an overload list — e.g. "Failed to
  // execute 'drawImage' on 'CanvasRenderingContext2D': The provided value is
  // not of type '(… or HTMLImageElement or …)'", and the same for
  // `texImage2D` / `createPattern` — which a canvas-heavy app hits for real.
  // This runs before origin tagging, so an unanchored match would discard even
  // a deliberate `reportError()` whose text happens to mention the interface.
  (message) =>
    message.startsWith('Uncaught') && message.includes('HTMLImageElement'),
  // PostHog's client-side rate-limit notice — analytics plumbing, not an error.
  (message) =>
    message.includes(
      '[PostHog.js] This capture call is ignored due to client rate limiting'
    )
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

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  if (isConsoleEchoOfReportedError(event)) return false

  const message = event.error.message
  if (RUM_NOISE_MESSAGE_MATCHERS.some((matches) => matches(message))) {
    return false
  }

  const isNetworkNoise =
    message.includes('csp_violation') || message.includes('Failed to fetch')
  return (
    !isNetworkNoise || !RUM_NOISE_HOSTS.some((host) => message.includes(host))
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

export const rumBeforeSend: RumBeforeSend = (event) => {
  if (!shouldKeepRumEvent(event)) return false
  if (event.type === 'error') {
    fingerprintFirebasePendingPromise(event)
    tagRumErrorOrigin(event)
  }
  return true
}
