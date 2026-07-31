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
  'resource:loadError',
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

function isThirdPartyLoadFailure(event: RumErrorEvent): boolean {
  const resourceUrl = event.error.resource?.url
  const target = resourceUrl ?? event.error.message
  if (
    !resourceUrl &&
    !RESOURCE_LOAD_FAILURE_MARKERS.some((marker) => target.includes(marker))
  ) {
    return false
  }
  return THIRD_PARTY_SCRIPT_ORIGINS.some((origin) => target.includes(origin))
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
