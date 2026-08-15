import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

const RUM_NOISE_HOSTS = [
  'facebook.com',
  'px.ads.linkedin.com',
  'browser-intake-us5-datadoghq.com',
  'e2.sy-d.io',
  'google-analytics.com',
  'googletagmanager.com'
]

/**
 * Origins of analytics/marketing scripts we embed but do not host. A load
 * failure from one of these is a client-side blocker (ad blocker, tracking
 * protection, corporate proxy, strict DNS), not a product defect, so it must
 * not count the session as errored. Only load failures are dropped — a runtime
 * error thrown by one of these scripts still reports.
 */
const THIRD_PARTY_SCRIPT_ORIGINS = [
  'connect.facebook.net',
  'cdn.sy-d.io',
  'e2.sy-d.io',
  'googletagmanager.com',
  'google-analytics.com',
  'utt.impactcdn.com',
  'px.ads.linkedin.com'
]

const RESOURCE_LOAD_FAILURE_MARKERS = [
  'loadError',
  'Failed to load',
  'Failed to fetch',
  'Load failed',
  'csp_violation'
]

const FIRST_PARTY_EXTENSION_FOLDERS = new Set(['cloud', 'core'])

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

const URL_IN_TEXT = /https?:\/\/[^\s'"<>)\]]+/g

function isThirdPartyHost(hostname: string): boolean {
  return THIRD_PARTY_SCRIPT_ORIGINS.some(
    (origin) => hostname === origin || hostname.endsWith(`.${origin}`)
  )
}

/**
 * Matches on the host of a URL rather than on the raw text, so one of our own
 * URLs that merely names an origin in its path or query is not mistaken for a
 * request to that origin.
 */
function namesThirdPartyOrigin(text: string): boolean {
  return [...text.matchAll(URL_IN_TEXT)].some(([url]) => {
    try {
      return isThirdPartyHost(new URL(url).hostname)
    } catch {
      return false
    }
  })
}

function isThirdPartyLoadFailure(event: RumErrorEvent): boolean {
  const resourceUrl = event.error.resource?.url
  if (resourceUrl) return namesThirdPartyOrigin(resourceUrl)

  const { message } = event.error
  return (
    RESOURCE_LOAD_FAILURE_MARKERS.some((marker) => message.includes(marker)) &&
    namesThirdPartyOrigin(message)
  )
}

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true

  const message = event.error.message
  if (message.startsWith('intervention:')) return false
  if (message.includes('ResizeObserver loop')) return false
  if (isThirdPartyLoadFailure(event)) return false

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
  if (event.type === 'error') tagRumErrorOrigin(event)
  return true
}
