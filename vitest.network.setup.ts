import { vi } from 'vitest'

const originalFetch = globalThis.fetch

function resolveRequestUrl(requestedUrl: string): string {
  try {
    const base = typeof location === 'undefined' ? undefined : location.href
    return new URL(requestedUrl, base).href
  } catch {
    return requestedUrl
  }
}

const blockedNetworkFetch: typeof globalThis.fetch = (input, init) => {
  const requestUrl = resolveRequestUrl(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  )

  if (!/^https?:/i.test(requestUrl)) {
    return originalFetch(input, init)
  }

  return Promise.reject(
    new Error(
      `Blocked a real network request to ${requestUrl} from a unit test. ` +
        'Mock the module that issues it (or configure vi.mocked(fetch) in the ' +
        'test) instead of letting the request escape - see vitest.network.setup.ts.'
    )
  )
}

globalThis.fetch = vi.fn(blockedNetworkFetch)
