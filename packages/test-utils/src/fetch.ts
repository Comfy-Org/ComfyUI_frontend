import { vi } from 'vitest'

type FetchArgs = Parameters<typeof fetch>
type FetchHandler = (...args: FetchArgs) => Response | Promise<Response>
type FetchRoute = string | RegExp | { method?: string; url?: string | RegExp }

interface FetchRequest {
  url: string
  method: string
  headers: Headers
  body: RequestInit['body']
}

function requestUrl(input: FetchArgs[0]): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function requestMethod(input: FetchArgs[0], init: FetchArgs[1]): string {
  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  return method.toUpperCase()
}

function urlMatches(pattern: string | RegExp | undefined, url: string) {
  if (pattern === undefined) return true
  return typeof pattern === 'string' ? pattern === url : pattern.test(url)
}

function routeMatches(route: FetchRoute, ...[input, init]: FetchArgs) {
  const url = requestUrl(input)
  if (typeof route === 'string' || route instanceof RegExp) {
    return urlMatches(route, url)
  }
  return (
    urlMatches(route.url, url) &&
    (route.method === undefined ||
      route.method.toUpperCase() === requestMethod(input, init))
  )
}

/**
 * Answers matching requests on the shared `fetch` mock from
 * `vitest.network.setup.ts`. Later routes are checked first; unmatched
 * requests fall through to earlier routes and finally to the network guard.
 * The handler runs per call, so each call can build a fresh `Response`.
 */
export function respondToFetch(
  route: FetchRoute,
  handler: FetchHandler,
  { times = Number.POSITIVE_INFINITY }: { times?: number } = {}
): void {
  const fallback = vi.mocked(fetch).getMockImplementation()
  if (!fallback) {
    throw new Error(
      'fetch has no implementation. Load vitest.network.setup.ts in this Vitest config.'
    )
  }
  let remaining = times
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (remaining <= 0 || !routeMatches(route, ...args)) {
      return fallback(...args)
    }
    remaining--
    return handler(...args)
  })
}

/** The requests sent through the shared `fetch` mock, optionally filtered by route. */
export function fetchRequests(route: FetchRoute = {}): FetchRequest[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter((args) => routeMatches(route, ...args))
    .map(([input, init]) => ({
      url: requestUrl(input),
      method: requestMethod(input, init),
      headers: new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      ),
      body: init?.body
    }))
}
