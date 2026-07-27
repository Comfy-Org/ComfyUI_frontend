import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosHeaders } from 'axios'

import { reportUnauthorized } from '@/platform/auth/session/sessionExpiry'
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
async function tryRemintToken(expectedToken: string): Promise<string | null> {
  try {
    const { useWorkspaceAuthStore } =
      await import('@/platform/workspace/stores/workspaceAuthStore')
    return await useWorkspaceAuthStore().remintUnifiedOnce(expectedToken)
  } catch (err) {
    console.warn('Unified re-mint primitive threw unexpectedly:', err)
    return null
  }
}

function bearerToken(authorization: unknown): string | undefined {
  if (typeof authorization !== 'string') return
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined
}

function fetchRequestHeaders(
  input: RequestInfo | URL,
  init: RequestInit
): Headers {
  if (init.headers !== undefined) return new Headers(init.headers)
  return input instanceof Request ? new Headers(input.headers) : new Headers()
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
 * flag-OFF traffic never enters the re-mint path, so the legacy token cascade
 * stays untouched for instant rollback.
 *
 * Reporting a surviving `401` to {@link reportUnauthorized} is deliberately NOT
 * behind that flag — the session dead-end it ends predates unified auth and
 * reproduces with the flag off. The report only opens an investigation; the
 * decision to end a session stays with that module's own oracles.
 */
export async function fetchWithUnifiedRemint(
  input: RequestInfo | URL,
  init: RequestInit,
  shouldRetryOn401: boolean
): Promise<Response> {
  const retryInput =
    shouldRetryOn401 && input instanceof Request && input.body !== null
      ? input.clone()
      : input
  const response = await fetch(input, init)
  if (response.status !== 401) {
    return response
  }

  const requestHeaders = fetchRequestHeaders(input, init)
  const expectedToken = bearerToken(requestHeaders.get('Authorization'))
  const replayable = !(init.body instanceof ReadableStream)

  if (shouldRetryOn401 && expectedToken && !replayable) {
    console.warn(
      'fetchWithUnifiedRemint: a ReadableStream body is not replayable; surfacing the original 401'
    )
  }

  const token =
    shouldRetryOn401 && expectedToken && replayable
      ? await tryRemintToken(expectedToken)
      : null
  if (!token) {
    void reportUnauthorized()
    return response
  }

  const headers = requestHeaders
  headers.set('Authorization', `Bearer ${token}`)
  const retried = await fetch(retryInput, { ...init, headers })
  if (retried.status === 401) void reportUnauthorized()
  return retried
}

function isUnauthorizedWithConfig(
  error: unknown
): error is AxiosError & { config: InternalAxiosRequestConfig } {
  if (!axios.isAxiosError(error)) return false
  if (error.response?.status !== 401) return false
  return error.config !== undefined
}

/**
 * Installs a response interceptor that gives a cloud axios client the same
 * reactive 401 guard as {@link fetchWithUnifiedRemint}: a single re-mint + a
 * single retry on `401`, surfacing a persistent `401` unchanged. While
 * `unified_cloud_auth` is OFF no re-mint is attempted and the original error
 * rejects exactly as it does today; a surviving `401` is still reported, for
 * the reason given on {@link fetchWithUnifiedRemint}.
 */
export function attachUnifiedRemintInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!isUnauthorizedWithConfig(error)) throw error

      const { config } = error
      const expectedToken = bearerToken(
        new AxiosHeaders(config.headers).get('Authorization')
      )
      const mayRemint =
        expectedToken !== undefined &&
        !config.__unifiedRetried &&
        !config.__skipUnifiedRemint &&
        (await shouldRemintCloudRequest())
      const token =
        mayRemint && expectedToken ? await tryRemintToken(expectedToken) : null

      if (!token) {
        void reportUnauthorized()
        throw error
      }

      // Clone (don't mutate) the caller's config so the re-minted Bearer never
      // leaks into a caller-retained reference, matching fetchWithUnifiedRemint.
      const headers = new AxiosHeaders(config.headers)
      headers.set('Authorization', `Bearer ${token}`)
      return client.request({ ...config, headers, __unifiedRetried: true })
    }
  )
}
