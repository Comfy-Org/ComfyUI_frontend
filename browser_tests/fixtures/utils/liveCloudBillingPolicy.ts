import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export function getLiveCloudDestinationViolation(
  url: URL,
  origins: ReadonlySet<string>,
  isNavigationRequest: boolean
): string | undefined {
  if (origins.has(url.origin)) return
  if (
    url.hostname.endsWith('.comfy.org') &&
    /^\/(api|customers)(\/|$)/.test(url.pathname)
  ) {
    return `API ${url.origin}${url.pathname}`
  }
  if (isNavigationRequest) {
    return `Navigation ${url.origin}${url.pathname}`
  }
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export function getBlockedRequestViolation(url: URL, method: string): string {
  const destination = `${url.origin}${url.pathname}`
  return SAFE_METHODS.includes(method.toUpperCase())
    ? `${method} ${destination}`
    : `Mutation ${method} ${destination}`
}

// A live run reports only these entries; an off-origin read the page happened
// to attempt is aborted either way and is not worth failing the run over.
export function isReportedViolation(violation: string): boolean {
  return /^(API|Navigation|Mutation|WebSocket) /.test(violation)
}

export function isLiveCloudMutationAllowed(
  url: URL,
  method: string,
  config: Pick<
    LiveCloudBillingConfig,
    'PLAYWRIGHT_SETUP_API_URL' | 'customerOrigin'
  >
): boolean {
  if (SAFE_METHODS.includes(method)) return true
  if (method !== 'POST') return false
  if (url.origin === 'https://identitytoolkit.googleapis.com') {
    return ['/v1/accounts:signInWithPassword', '/v1/accounts:lookup'].includes(
      url.pathname
    )
  }
  if (url.origin === 'https://securetoken.googleapis.com') {
    return url.pathname === '/v1/token'
  }
  if (url.pathname === '/customers') {
    return url.origin === config.customerOrigin
  }
  return (
    url.origin === config.PLAYWRIGHT_SETUP_API_URL &&
    ['/api/auth/token', '/api/auth/session'].includes(url.pathname)
  )
}
