import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

import { ASSERTION_FAILURE_PREFIX, hasRumAssertReporter } from '@/base/assert'

import { REPORTED_ERROR_PREFIX } from './reportError'

const RUM_NOISE_HOSTS = [
  'facebook.com',
  // Facebook's pixel/SDK is served from facebook.NET, not .com, so the CSP
  // reports it triggers name a host the .com entry never matched.
  'facebook.net',
  'px.ads.linkedin.com',
  'browser-intake-us5-datadoghq.com',
  'e2.sy-d.io',
  'google-analytics.com',
  'googletagmanager.com'
]

/**
 * Matches a PARSED hostname, not a substring of the message. A bare
 * `message.includes(host)` also matches lookalikes (`notfacebook.com`) and any
 * first-party URL that merely carries a noise host in a path or query
 * parameter (a proxy or redirect param), silently suppressing real errors.
 */
function isNoiseHostname(hostname: string): boolean {
  return RUM_NOISE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  )
}

/** Every absolute-URL hostname in `text`, skipping anything unparseable. */
function hostnamesIn(text: string | undefined): string[] {
  if (!text) return []
  const hostnames: string[] = []
  for (const [url] of text.matchAll(/https?:\/\/[^\s'"<>)\]]+/g)) {
    try {
      hostnames.push(new URL(url).hostname)
    } catch {
      // Not a URL we can parse — it cannot prove noise, so ignore it.
    }
  }
  return hostnames
}

function namesNoiseHost(text: string | undefined): boolean {
  return hostnamesIn(text).some(isNoiseHostname)
}

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

/**
 * Fetch failures only. CSP violations are decided by `isNoiseCspViolation`
 * below: routing them through here too would drop a violation whose message
 * merely names a noise host BEFORE the CSP rule could judge its origin, losing
 * first-party CSP defects involving a third-party resource.
 */
function isFetchFailureToNoiseHost(message: string): boolean {
  return message.includes('Failed to fetch') && namesNoiseHost(message)
}

const CSP_VIOLATION_PREFIX = 'csp_violation:'

/**
 * A CSP violation is the browser enforcing our policy, and the bulk are
 * ad/tracking scripts we are happy to see blocked. Drop those — but only when
 * a known noise host is actually named, by the blocked URI or by the frame the
 * SDK attributed the violation to.
 *
 * Deliberately NOT "drop unless provably first party", which is what an origin
 * check amounts to here. `classifyRumErrorOrigin` answers `third_party` both
 * for a genuinely foreign stack and for NO stack at all, and no-stack is the
 * normal shape of a first-party report: markup-initiated blocks (`img-src`,
 * `font-src`, linked `style-src`, inline `<script>`) carry no `sourceFile`, so
 * the SDK builds no stack, and script-attributed ones often point at the
 * document URL or a `blob:` we created. Dropping on origin also discards the
 * CSP regressions worth paging on — a tightening that blocks a required CDN
 * script, font, or auth/payment SDK, or an injected supply-chain script —
 * because every one of those presents as a third-party stack.
 *
 * Unattributable violations are therefore KEPT. Noise we can prove is noise,
 * and the rest stays visible.
 */
function isNoiseCspViolation(event: RumErrorEvent): boolean {
  // Anchored: genuine SDK reports are prefixed `csp_violation:`. An unanchored
  // test also catches anything merely quoting the token — a console echo of a
  // report, or a message embedding user- or URL-supplied text.
  if (!event.error.message.startsWith(CSP_VIOLATION_PREFIX)) return false

  return (
    namesNoiseHost(event.error.message) || namesNoiseHost(event.error.stack)
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true
  if (isConsoleEchoOfReportedAssertion(event)) return false
  if (isConsoleEchoOfReportedError(event)) return false

  const message = event.error.message
  if (message.startsWith('intervention:')) return false
  if (message.includes('ResizeObserver loop')) return false

  if (isFetchFailureToNoiseHost(message)) return false
  if (isNoiseCspViolation(event)) return false

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
