import type { Page, Request } from '@playwright/test'

export const DESKTOP_RELAY_NONCE = '3f1c2b7e-9a4d-4c1e-8b2f-6d5e4a3b2c1d'

function isOpenOnCloudTraffic(request: Request): boolean {
  const url = new URL(request.url())
  return (
    url.pathname.endsWith('/api/cloud/compatibility') ||
    decodeURIComponent(url.pathname).includes('/userdata/open-on-cloud/')
  )
}

/** Collect the decoded URLs of every Open on Cloud request the page sends. */
export function recordOpenOnCloudTraffic(page: Page): string[] {
  const traffic: string[] = []
  page.on('request', (request) => {
    if (isOpenOnCloudTraffic(request))
      traffic.push(decodeURIComponent(request.url()))
  })
  return traffic
}
