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

export function isLiveCloudMutationAllowed(url: URL, method: string): boolean {
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
  return ['/customers', '/api/auth/token', '/api/auth/session'].includes(
    url.pathname
  )
}
