# @comfyorg/test-utils

Shared Vitest helpers for tests across the monorepo. Test-only; never import
from production code.

## `@comfyorg/test-utils/fetch`

Every Vitest config loads `vitest.network.setup.ts`, which installs `fetch` as
a `vi.fn` that rejects real network requests. `mockReset` restores that guard
before each test.

- `respondToFetch(route, handler, { times })` answers requests that match
  `route` (an exact URL, a `RegExp`, or `{ method, url }`). The handler runs
  per call, so return a new `Response` each time. Later routes are checked
  first; unmatched requests fall through to earlier routes and then to the
  guard.
- `fetchRequests(route?)` lists the `url`, `method`, `headers`, and `body` of
  the requests sent so far.

```ts
respondToFetch(TOKEN_URL, () => Response.json(token))
respondToFetch(TOKEN_URL, () => Promise.reject(new TypeError('offline')), {
  times: 1
})

await store.refresh()

expect(fetchRequests(TOKEN_URL)).toHaveLength(2)
```

Assert on `fetch` directly (`expect(fetch).toHaveBeenCalledWith(...)`) rather
than on a separate `vi.fn` installed with `mockImplementation`.
