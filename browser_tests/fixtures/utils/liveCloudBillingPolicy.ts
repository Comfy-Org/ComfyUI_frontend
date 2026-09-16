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

export function getLiveCloudCustomerOrigin(
  cloudOrigin: string
): string | undefined {
  if (cloudOrigin === 'https://testcloud.comfy.org')
    return 'https://testapi.comfy.org'
  if (cloudOrigin === 'https://stagingcloud.comfy.org')
    return 'https://stagingapi.comfy.org'
  if (/^https:\/\/pr-\d+\.testenvs\.comfy\.org$/.test(cloudOrigin)) {
    return cloudOrigin.replace('.testenvs.', '-registry.testenvs.')
  }
}

export function isLiveCloudMutationAllowed(
  url: URL,
  method: string,
  config: Pick<LiveCloudBillingConfig, 'PLAYWRIGHT_SETUP_API_URL'>
): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
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
    return (
      url.origin === getLiveCloudCustomerOrigin(config.PLAYWRIGHT_SETUP_API_URL)
    )
  }
  return (
    url.origin === config.PLAYWRIGHT_SETUP_API_URL &&
    ['/api/auth/token', '/api/auth/session'].includes(url.pathname)
  )
}
