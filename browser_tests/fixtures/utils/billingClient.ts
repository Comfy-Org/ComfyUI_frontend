import type { Request } from '@playwright/test'

const AXIOS_DEFAULT_ACCEPT = 'application/json, text/plain, */*'

/**
 * Which billing client issued a request: the legacy axios client or the SDK
 * transport.
 */
export function billingClient(request: Request): 'legacy' | 'sdk' {
  return request.headers()['accept'] === AXIOS_DEFAULT_ACCEPT ? 'legacy' : 'sdk'
}
