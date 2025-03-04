import QuickLRU from '@alloc/quick-lru'

import { paramsToCacheKey } from '@/utils/formatUtil'

const DEFAULT_MAX_SIZE = 50

export interface CachedRequestOptions {
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
 * Composable that wraps a function with memoization and request deduplication.
 */
export function useCachedRequest<TParams, TResult>(
  requestFunction: (
    params: TParams,
    signal?: AbortSignal
  ) => Promise<TResult | null>,
  options: CachedRequestOptions = {}
) {
  const { maxSize = DEFAULT_MAX_SIZE, cacheKeyFn = paramsToCacheKey } = options

  const cache = new QuickLRU<string, TResult>({ maxSize })
  const pendingRequests = new Map<string, Promise<TResult | null>>()
  const abortControllers = new Map<string, AbortController>()

  const executeAndCacheCall = async (
    params: TParams,
    cacheKey: string
  ): Promise<TResult | null> => {
    try {
      const controller = new AbortController()
      abortControllers.set(cacheKey, controller)

      const responsePromise = requestFunction(params, controller.signal)
      pendingRequests.set(cacheKey, responsePromise)

      const result = await responsePromise
      if (result) cache.set(cacheKey, result)

      return result
    } catch (err) {
      const isAborted = err instanceof DOMException && err.name === 'AbortError'
      if (!isAborted)
        console.error(`Error in request with params ${cacheKey}:`, err)

      return null
    } finally {
      pendingRequests.delete(cacheKey)
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

  const abortAllRequests = () => {
    for (const controller of abortControllers.values()) {
      controller.abort()
    }
  }

  /**
   * Cancel and clear any pending requests
   */
  const cancel = () => {
    abortAllRequests()
    abortControllers.clear()
    pendingRequests.clear()
  }

  /**
   * Cached version of the request function
   */
  const call = async (params: TParams): Promise<TResult | null> => {
    const cacheKey = cacheKeyFn(params)

    const cachedResult = cache.get(cacheKey)
    if (cachedResult) return cachedResult

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
