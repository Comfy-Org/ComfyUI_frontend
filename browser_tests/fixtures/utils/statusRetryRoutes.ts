import type { ErrorResponse } from '@comfyorg/ingest-types'
import type { Page, Request, Route } from '@playwright/test'

const CAPABILITIES_PATH = '/api/billing/capabilities'
export const CAPABILITIES_ROUTE = `**${CAPABILITIES_PATH}`
export const STATUS_RETRY_PROBE_ROUTE = '**/api/status-retry-probe'

const SERVICE_UNAVAILABLE: ErrorResponse = {
  code: 'service_unavailable',
  message: 'Temporarily unavailable, please retry'
}

/** Answers a request with a retryable 503. */
export function fulfillUnavailable(route: Route): Promise<void> {
  return route.fulfill({ status: 503, json: SERVICE_UNAVAILABLE })
}

/** Records every capabilities request whose response has finished downloading. */
export function recordFinishedCapabilityReads(page: Page): Request[] {
  const reads: Request[] = []
  page.on('requestfinished', (request) => {
    if (new URL(request.url()).pathname.endsWith(CAPABILITIES_PATH))
      reads.push(request)
  })
  return reads
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
