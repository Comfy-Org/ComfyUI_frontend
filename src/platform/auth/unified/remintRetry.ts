import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import axios from 'axios'

// Per-request markers for the reactive 401 guard: `__unifiedRetried` latches a
// single retry so a replayed request can never trigger a second re-mint, and
// `__skipUnifiedRemint` exempts the deliberately Firebase-authed acceptInvite
// call from the unified re-mint.
declare module 'axios' {
  interface AxiosRequestConfig {
    __unifiedRetried?: boolean
    __skipUnifiedRemint?: boolean
  }
}

/**
 * Re-mints the unified Cloud JWT once from the current Firebase identity and
 * returns the fresh token, or `null` when there is nothing to retry with: the
 * `unified_cloud_auth` flag is OFF, there is no active unified session, or the
 * re-mint failed. A permanent auth failure is surfaced + torn down inside
 * `remintUnifiedOnce` (error toast + session clear, matching the proactive
 * refresh path); the `catch` here only guards an unexpected throw. Either way
 * `null` makes the caller surface its original 401 unchanged.
 */
async function tryRemintToken(): Promise<string | null> {
  try {
    const { useWorkspaceAuthStore } =
      await import('@/platform/workspace/stores/workspaceAuthStore')
    return await useWorkspaceAuthStore().remintUnifiedOnce()
  } catch {
    return null
  }
}

/**
 * Issues a `fetch` and, on a `401`, re-mints the unified Cloud JWT once and
 * retries the request exactly once with the fresh token. A persistent `401`
 * (or a `null` re-mint) surfaces the original Response unchanged — there is no
 * retry loop.
 *
 * `shouldRetryOn401` is the caller's gate: pass `isCloud &&
 * unifiedCloudAuthEnabled` for requests that carry the unified Bearer so that
 * flag-OFF traffic returns after a single `fetch` and never enters the re-mint
 * path (the legacy cascade stays untouched for instant rollback).
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
      if (!isRetriableUnauthorized(error)) {
        throw error
      }

      const { useFeatureFlags } = await import('@/composables/useFeatureFlags')
      if (!useFeatureFlags().flags.unifiedCloudAuthEnabled) {
        throw error
      }

      const { config } = error
      config.__unifiedRetried = true

      const token = await tryRemintToken()
      if (!token) {
        throw error
      }

      config.headers.Authorization = `Bearer ${token}`
      return client.request(config)
    }
  )
}
