import type { RumBeforeSend, RumErrorEvent } from '@datadog/browser-rum'

const RUM_NOISE_HOSTS = [
  'facebook.com',
  'px.ads.linkedin.com',
  'browser-intake-us5-datadoghq.com',
  'e2.sy-d.io',
  'google-analytics.com',
  'googletagmanager.com'
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

function shouldKeepRumEvent(event: Parameters<RumBeforeSend>[0]): boolean {
  if (event.type !== 'error') return true

  const message = event.error.message
  if (message.startsWith('intervention:')) return false
  if (message.includes('ResizeObserver loop')) return false

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
