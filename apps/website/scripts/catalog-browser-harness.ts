import type { BrowserContext, Page, Route } from '@playwright/test'

// Shared setup for the local CCC browser checks: each check mounts a real
// compiled component against a running frontend, so the page must be unable
// to write or to reach anything but that frontend's own static files.

/** A page with no WebSockets that records every uncaught page error. */
export async function isolatedPage(
  context: BrowserContext
): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage()
  await page.routeWebSocket('**', (socket) => socket.close())
  await page.addInitScript('globalThis.__name = (value) => value')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { page, errors }
}

/**
 * Lets through only same-origin GETs outside `blocked`, after `fulfill` has
 * had a chance to answer a fixture request. Every non-GET is aborted and
 * recorded in the returned list, so a check can assert it never wrote.
 */
export async function readOnlyRoutes(
  context: BrowserContext,
  website: string,
  {
    blocked = /^\/(?:admin|api)\//,
    fulfill
  }: {
    blocked?: RegExp
    fulfill?: (url: URL, route: Route) => Promise<boolean>
  } = {}
): Promise<string[]> {
  const writes: string[] = []
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (await rejectWrite(route, url, writes)) return
    if (fulfill && (await fulfill(url, route))) return
    await staticRequest(route, url, website, blocked)
  })
  return writes
}
async function rejectWrite(route: Route, url: URL, writes: string[]) {
  const method = route.request().method()
  if (method === 'GET') return false
  writes.push(`${method} ${url.pathname}`)
  await route.abort()
  return true
}
function allowedStaticURL(url: URL, website: string, blocked: RegExp) {
  return url.origin === website && !blocked.test(url.pathname)
}
async function staticRequest(
  route: Route,
  url: URL,
  website: string,
  blocked: RegExp
) {
  if (allowedStaticURL(url, website, blocked)) await route.continue()
  else await route.abort()
}
