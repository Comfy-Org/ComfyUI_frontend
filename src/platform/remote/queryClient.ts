import { QueryClient } from '@tanstack/vue-query'

import { isRetriableError } from '@/base/remote/retry'

const DEFAULT_GC_TIME_MS = 5 * 60_000
const DEFAULT_RETRY_COUNT = 3

let appQueryClient: QueryClient | undefined

/**
 * Create the application-wide TanStack Query client.
 *
 * Defaults are tuned for remote-option dropdowns and similar widget data:
 * - `staleTime: 0` so refresh buttons always re-fetch
 * - `gcTime` bounded so a session's footprint stays small (no LRU yet)
 * - `retry` driven by {@link isRetriableError} from `base/remote/retry`
 * - `refetchOnWindowFocus: false` to avoid surprise re-fetches mid-edit
 *
 * QueryClient lifetime is bound to the Vue app instance; auth-state changes
 * tear down the authenticated layout subtree (see master plan §8), so the
 * cache is naturally evicted without manual `queryClient.clear()` calls.
 */
export function createAppQueryClient(): QueryClient {
  appQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: DEFAULT_GC_TIME_MS,
        retry: (failureCount, error) =>
          failureCount < DEFAULT_RETRY_COUNT && isRetriableError(error),
        refetchOnWindowFocus: false
      }
    }
  })
  return appQueryClient
}

export function getAppQueryClient(): QueryClient {
  if (!appQueryClient) {
    appQueryClient = createAppQueryClient()
  }
  return appQueryClient
}
