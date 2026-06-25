import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosHeaders } from 'axios'

import { isCloud } from '@/platform/distribution/types'

let cachedUnifiedFlags:
  | { readonly unifiedCloudAuthEnabled: boolean }
  | undefined

/**
 * Single gate for the reactive guard: a cloud build with `unified_cloud_auth`
 * ON. Memoizes the feature-flag accessor so the hot `fetchApi` path does not
 * build a fresh reactive proxy per request (the cached getter still reflects
 * live flag changes), and is reused at every cloud request seam so the gate
 * cannot be forgotten on a new call site.
 */
export async function shouldRemintCloudRequest(): Promise<boolean> {
  if (!isCloud) return false
  if (!cachedUnifiedFlags) {
    const { useFeatureFlags } = await import('@/composables/useFeatureFlags')
    cachedUnifiedFlags = useFeatureFlags().flags
  }
  return cachedUnifiedFlags.unifiedCloudAuthEnabled
}

/**
 * Re-mints the unified Cloud JWT once from the current Firebase identity and
 * returns the fresh token, or `null` when there is nothing to retry with: no
 * active unified session, or the re-mint failed. A permanent auth failure is
 * surfaced + torn down inside `remintUnifiedOnce` (error toast + session clear,
 * matching the proactive refresh path); the `catch` here only guards an
 * unexpected throw (e.g. a chunk-load failure or no active Pinia), which it
 * logs. Either way `null` makes the caller surface its original 401 unchanged.
 */
async function tryRemintToken(): Promise<string | null> {
  try {
    const { useWorkspaceAuthStore } =
      await import('@/platform/workspace/stores/workspaceAuthStore')
    return await useWorkspaceAuthStore().remintUnifiedOnce()
  } catch (err) {
    console.warn('Unified re-mint primitive threw unexpectedly:', err)
    return null
  }
}

/**
 * Issues a `fetch` and, on a `401`, re-mints the unified Cloud JWT once and
 * retries the request exactly once with the fresh token. A persistent `401`
 * (or a `null` re-mint) surfaces the original Response unchanged — no retry
 * loop. Requires a replayable body: a one-shot `ReadableStream` body cannot be
 * replayed, so such a request surfaces its original `401` without a retry (no
 * current cloud caller sends one).
 *
 * `shouldRetryOn401` is the caller's gate (see {@link shouldRemintCloudRequest}):
 * flag-OFF traffic returns after a single `fetch` and never enters the re-mint
 * path, so the legacy cascade stays untouched for instant rollback.
 */
export async function fetchWithUnifiedRemint(
  input: RequestInfo | URL,
  init: RequestInit,
  shouldRetryOn401: boolean
): Promise<Response> {
  const response = await fetch(input, init)
  if (!shouldRetryOn401 || response.status !== 401) {
    return response
  }

  if (init.body instanceof ReadableStream) {
    console.warn(
      'fetchWithUnifiedRemint: a ReadableStream body is not replayable; surfacing the original 401'
    )
    return response
  }

  const token = await tryRemintToken()
  if (!token) {
    return response
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

function isRetriableUnauthorized(
  error: unknown
): error is AxiosError & { config: InternalAxiosRequestConfig } {
  if (!axios.isAxiosError(error)) return false
  const config = error.config
  if (!config || config.__unifiedRetried || config.__skipUnifiedRemint) {
    return false
  }
  return error.response?.status === 401
}

/**
 * Installs a response interceptor that gives a cloud axios client the same
 * reactive 401 guard as {@link fetchWithUnifiedRemint}: a single re-mint + a
 * single retry on `401`, surfacing a persistent `401` unchanged. A strict
 * no-op while `unified_cloud_auth` is OFF — the original error rejects exactly
 * as it does today.
 */
export function attachUnifiedRemintInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (
        !isRetriableUnauthorized(error) ||
        !(await shouldRemintCloudRequest())
      ) {
        throw error
      }

      const token = await tryRemintToken()
      if (!token) {
        throw error
      }

      // Clone (don't mutate) the caller's config so the re-minted Bearer never
      // leaks into a caller-retained reference, matching fetchWithUnifiedRemint.
      const { config } = error
      const headers = new AxiosHeaders(config.headers)
      headers.set('Authorization', `Bearer ${token}`)
      return client.request({ ...config, headers, __unifiedRetried: true })
    }
  )
}
