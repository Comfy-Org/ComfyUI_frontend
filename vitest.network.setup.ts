const originalFetch = globalThis.fetch

function resolveRequestUrl(input: RequestInfo | URL): string {
  const requestedUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

  try {
    const base = typeof location === 'undefined' ? undefined : location.href
    return new URL(requestedUrl, base).href
  } catch {
    return requestedUrl
  }
}

const blockedNetworkFetch: typeof globalThis.fetch = (input, init) => {
  const requestUrl = resolveRequestUrl(input)

  if (!/^https?:/i.test(requestUrl)) {
    return originalFetch(input, init)
  }

  return Promise.reject(
    new Error(
      `Blocked a real network request to ${requestUrl} from a unit test. ` +
        'Mock the module that issues it (or stub globalThis.fetch in the ' +
        'test) instead of letting the request escape - see vitest.setup.ts.'
    )
  )
}

globalThis.fetch = blockedNetworkFetch

export {}
