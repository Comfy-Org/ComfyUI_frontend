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

const EXTENSION_TAB_NOT_FOUND_MESSAGE =
  'Invalid call to runtime.sendMessage(). Tab not found.'

const RUM_NOISE_HOSTS = [
  'facebook.com',
  'px.ads.linkedin.com',
  'browser-intake-us5-datadoghq.com',
  'e2.sy-d.io',
  'google-analytics.com',
  'googletagmanager.com'
]

export function isThirdPartyErrorNoise(message?: string): boolean {
  if (!message) return false
  const index = message.indexOf(EXTENSION_TAB_NOT_FOUND_MESSAGE)
  if (index < 0) return false
  const prefix = message.slice(0, index)
  return /^(?:Unhandled promise rejection:\s*)?(?:Error:\s*)?$/.test(prefix)
}

/** An error no Comfy page raised or can act on. */
export function isRumErrorNoise(error: {
  readonly message: string
  readonly source?: string
}): boolean {
  const { message } = error
  if (error.source === 'console' && message.startsWith(REPORTED_ERROR_PREFIX))
    return true
  if (isThirdPartyErrorNoise(message)) return true
  if (message.startsWith('intervention:')) return true
  if (message.includes('ResizeObserver loop')) return true

  const isNetworkNoise =
    message.includes('csp_violation') || message.includes('Failed to fetch')
  return (
    isNetworkNoise && RUM_NOISE_HOSTS.some((host) => message.includes(host))
  )
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
