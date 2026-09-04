import type { AxiosInstance, AxiosResponse } from 'axios'
import { computed, ref } from 'vue'

import { isAbortError } from '@/utils/typeGuardUtil'

/**
 * Maps a caught request error to a user-facing message string.
 * Each service injects its own mapper so it keeps control of the exact
 * status-to-message copy it presents.
 */
export type ApiErrorMapper = (
  err: unknown,
  errorContext: string,
  routeSpecificErrors?: Record<number, string>
) => string

export interface ExecuteRequestOptions {
  errorContext: string
  routeSpecificErrors?: Record<number, string>
  /**
   * Side effect run after a successful response, before the data is returned.
   * Returning `false` marks the overall request as failed: `executeRequest`
   * resolves to `null` and leaves `error` as the side effect set it.
   */
  onSuccess?: () => boolean | void | Promise<boolean | void>
  /**
   * Called with the mapped message when *this* request fails, so a caller can
   * tell its own failure apart from the shared `error` ref, which any
   * concurrent request may reset or overwrite. Not called on cancellation.
   */
  onError?: (message: string) => void
}

/**
 * Shared axios request wrapper: owns the `isLoading`/`error` state and the
 * try/catch/finally plumbing, while the caller injects the axios instance and
 * an error mapper. Cancellations are swallowed (no error set, `null` returned).
 */
export function useApiRequest({
  client,
  mapError
}: {
  client: AxiosInstance
  mapError: ApiErrorMapper
}) {
  const pendingCount = ref(0)
  const isLoading = computed(() => pendingCount.value > 0)
  const error = ref<string | null>(null)

  async function executeRequest<T>(
    apiCall: (client: AxiosInstance) => Promise<AxiosResponse<T>>,
    options: ExecuteRequestOptions
  ): Promise<T | null> {
    const { errorContext, routeSpecificErrors, onSuccess, onError } = options

    pendingCount.value++
    error.value = null

    try {
      const response = await apiCall(client)
      if ((await onSuccess?.()) === false) return null
      return response.data
    } catch (err) {
      if (isAbortError(err)) return null

      const message = mapError(err, errorContext, routeSpecificErrors)
      error.value = message
      onError?.(message)
      return null
    } finally {
      pendingCount.value--
    }
  }

  return { isLoading, error, executeRequest }
}
