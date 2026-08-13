import QuickLRU from '@alloc/quick-lru'

import { paramsToCacheKey } from '@/utils/formatUtil'

const DEFAULT_MAX_SIZE = 50

interface CachedRequestOptions {
  /**
   * Maximum number of items to store in the cache
   * @default 50
   */
  maxSize?: number
  /**
   * Function to generate a cache key from parameters
   */
  cacheKeyFn?: (params: unknown) => string
}

/**
 * Composable that wraps a function with memoization, request deduplication, and abort handling.
 */
export function useCachedRequest<TParams, TResult>(
  requestFunction: (
    params: TParams,
    signal?: AbortSignal
  ) => Promise<TResult | null>,
  options: CachedRequestOptions = {}
) {
  const { maxSize = DEFAULT_MAX_SIZE, cacheKeyFn = paramsToCacheKey } = options

  const cache = new QuickLRU<string, TResult | null>({ maxSize })
  const pendingRequests = new Map<string, Promise<TResult | null>>()
  const abortControllers = new Map<string, AbortController>()

  const executeAndCacheCall = async (
    params: TParams,
    cacheKey: string
  ): Promise<TResult | null> => {
    const controller = new AbortController()
    abortControllers.set(cacheKey, controller)

    const responsePromise = requestFunction(params, controller.signal)
    pendingRequests.set(cacheKey, responsePromise)

    try {
      const result = await responsePromise
      // A cancellation is not a verdict about the resource, so caching it would
      // make the cancellation permanent for the rest of the session.
      if (!controller.signal.aborted) cache.set(cacheKey, result)

      return result
    } catch (err) {
      // Set cache on error to prevent retrying bad requests
      if (!controller.signal.aborted) cache.set(cacheKey, null)
      return null
    } finally {
      if (pendingRequests.get(cacheKey) === responsePromise)
        pendingRequests.delete(cacheKey)
      if (abortControllers.get(cacheKey) === controller)
        abortControllers.delete(cacheKey)
    }
  }

  const handlePendingRequest = async (
    pendingRequest: Promise<TResult | null>
  ): Promise<TResult | null> => {
    try {
      return await pendingRequest
    } catch (err) {
      console.error('Error in pending request:', err)
      return null
    }
  }

  const abortRequest = (cacheKey: string) => {
    abortControllers.get(cacheKey)?.abort()
    abortControllers.delete(cacheKey)
    pendingRequests.delete(cacheKey)
  }

  /**
   * Cancel pending requests: only the one matching `params` when given, every
   * pending request otherwise. Callers sharing an instance should pass their own
   * params so they don't abort requests another caller is waiting on.
   */
  const cancel = (...params: [] | [TParams]) => {
    if (params.length === 0) {
      for (const cacheKey of [...abortControllers.keys()])
        abortRequest(cacheKey)
      pendingRequests.clear()
      return
    }

    abortRequest(cacheKeyFn(params[0]))
  }

  /**
   * Cached version of the request function
   */
  const call = async (params: TParams): Promise<TResult | null> => {
    const cacheKey = cacheKeyFn(params)

    const cachedResult = cache.get(cacheKey)
    if (cachedResult !== undefined) return cachedResult

    const pendingRequest = pendingRequests.get(cacheKey)
    if (pendingRequest) return handlePendingRequest(pendingRequest)

    return executeAndCacheCall(params, cacheKey)
  }

  return {
    call,
    cancel,
    clear: () => cache.clear()
  }
}
