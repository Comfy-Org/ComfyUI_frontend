/** The backend family a RUM session reports under, as Datadog and backend engineers name it. */
export type DeployEnv = 'prod-v2' | 'stg-v2' | 'test-v2'

/** One RUM application for every Comfy web surface; each sets its own `service`. */
export const COMFY_RUM_APPLICATION = {
  clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
  applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
  site: 'us5.datadoghq.com'
} as const

export const DEFAULT_POSTHOG_API_HOST = 'https://t.comfy.org'

/** PostHog settings every Comfy web surface shares; each adds its own token, host and before_send. */
export const COMFY_POSTHOG_OPTIONS = {
  ui_host: 'https://us.posthog.com',
  autocapture: false,
  capture_pageview: 'history_change',
  capture_pageleave: false,
  persistence: 'localStorage+cookie',
  person_profiles: 'identified_only'
} as const

/**
 * Marks the console line a reporter writes for every report. RUM collects
 * `console.error` on its own, so `isRumErrorNoise` matches on this to drop the
 * untagged console copy of a failure RUM already received tagged.
 */
export const REPORTED_ERROR_PREFIX = '[Reported error]: '

const EXTENSION_ERROR_MESSAGES = [
  'Invalid call to runtime.sendMessage(). Tab not found.',
  '[messaging] In this JS context, only one listener can be setup for'
]

const ERROR_MESSAGE_PREFIX =
  /^(?:Unhandled promise rejection:\s*)?(?:Error:\s*)?$/

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

export function namesRumNoiseHost(text: string | undefined): boolean {
  return hostnamesIn(text).some(isNoiseHostname)
}

/**
 * Fetch failures only. CSP violations are decided by `isNoiseCspViolation`
 * below: routing them through here too would drop a violation whose message
 * merely names a noise host BEFORE the CSP rule could judge its origin, losing
 * first-party CSP defects involving a third-party resource.
 */
function isFetchFailureToNoiseHost(message: string): boolean {
  return message.includes('Failed to fetch') && namesRumNoiseHost(message)
}

const CSP_VIOLATION_PREFIX = 'csp_violation:'

/**
 * A CSP violation is the browser enforcing our policy, and the bulk are
 * ad/tracking scripts we are happy to see blocked. Drop those — but only when
 * a known noise host is actually named, by the blocked URI or by the frame the
 * SDK attributed the violation to.
 *
 * Deliberately NOT "drop unless provably first party". No stack is the normal
 * shape of a first-party report: markup-initiated blocks (`img-src`,
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
function isNoiseCspViolation(message: string, stack?: string): boolean {
  // Anchored: genuine SDK reports are prefixed `csp_violation:`. An unanchored
  // test also catches anything merely quoting the token — a console echo of a
  // report, or a message embedding user- or URL-supplied text.
  if (!message.startsWith(CSP_VIOLATION_PREFIX)) return false

  return namesRumNoiseHost(message) || namesRumNoiseHost(stack)
}

export function isThirdPartyErrorNoise(message?: string): boolean {
  if (!message) return false
  return EXTENSION_ERROR_MESSAGES.some((known) => {
    const index = message.indexOf(known)
    return index >= 0 && ERROR_MESSAGE_PREFIX.test(message.slice(0, index))
  })
}

/** An error no Comfy page raised or can act on. */
export function isRumErrorNoise(error: {
  readonly message: string
  readonly source?: string
  readonly stack?: string
}): boolean {
  const { message } = error
  if (error.source === 'console' && message.startsWith(REPORTED_ERROR_PREFIX))
    return true
  if (isThirdPartyErrorNoise(message)) return true
  if (message.startsWith('intervention:')) return true
  if (message.includes('ResizeObserver loop')) return true

  if (isFetchFailureToNoiseHost(message)) return true
  return isNoiseCspViolation(message, error.stack)
}

/** Origin and path only: a query or fragment can carry a client secret or an email. */
export function stripUrlQuery(url: string): string {
  return url.replace(/[?#].*$/s, '')
}

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>()]*/g

const SENSITIVE_TEXT_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'],
  [/\b(Bearer\s+)[\w.~+/-]+=*/gi, '$1[token]'],
  [/\b\w+_secret_\w+/g, '[token]'],
  // Anchored on the character before the address, so a long run of
  // address characters is scanned once instead of from every offset.
  [
    /(^|[^\w.%+-])[\w.%+-]+(?:@|%40)[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi,
    '$1[email]'
  ]
]

/** Free text with every URL query, token, client secret and email taken out. */
export function redactSensitiveText(text: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (redacted, [pattern, replacement]) =>
      redacted.replace(pattern, replacement),
    text.replace(URL_PATTERN, stripUrlQuery)
  )
}
