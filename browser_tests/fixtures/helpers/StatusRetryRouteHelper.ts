import type { Page, Request, Route } from '@playwright/test'

export const CAPABILITIES_ROUTE = '**/api/billing/capabilities'
export const STATUS_RETRY_PROBE_ROUTE = '**/api/status-retry-probe'

/** Answers a request with a retryable 503 that asks for an immediate retry. */
export function fulfillUnavailable(route: Route): Promise<void> {
  return route.fulfill({
    status: 503,
    headers: { 'Retry-After': '0' },
    json: { message: 'Temporarily unavailable, please retry' }
  })
}

/** Routes GETs on `routeGlob` to 503 for the first `unavailableCount` answers, recording each GET. */
export async function routeUnavailableGets(
  page: Page,
  routeGlob: string,
  unavailableCount: number,
  recovered: (route: Route) => Promise<void> = (route) => route.fallback()
): Promise<Request[]> {
  const gets: Request[] = []
  await page.route(routeGlob, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    gets.push(route.request())
    return gets.length <= unavailableCount
      ? fulfillUnavailable(route)
      : recovered(route)
  })
  return gets
}

/** Sends one request through the app's own transport and returns its final status. */
export function fetchThroughApp(
  page: Page,
  route: string,
  method: 'GET' | 'POST'
): Promise<number> {
  return page.evaluate(
    async ({ route, method }) => {
      const response = await window.app!.api.fetchApi(route, {
        method,
        body: method === 'POST' ? '{}' : undefined
      })
      return response.status
    },
    { route, method }
  )
}
