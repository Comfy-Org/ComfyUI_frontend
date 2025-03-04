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
 * Composable that creates a cached version of a function with LRU caching
 * and request deduplication.
 */
export function useCachedRequest<TParams, TResult>(
  requestFunction: (params: TParams) => Promise<TResult | null>,
  options: CachedRequestOptions = {}
) {
  const { maxSize = DEFAULT_MAX_SIZE, cacheKeyFn = paramsToCacheKey } = options

  const cache = new QuickLRU<string, TResult>({ maxSize })
  const pendingRequests = new Map<string, Promise<TResult | null>>()

  const getFromCache = (params: TParams): TResult | null => {
    const cacheKey = cacheKeyFn(params)
    return cache.get(cacheKey) || null
  }

  const executeAndCacheCall = async (
    params: TParams,
    cacheKey: string
  ): Promise<TResult | null> => {
    try {
      const result = await requestFunction(params)
      if (result) {
        cache.set(cacheKey, result)
      }
      return result
    } catch (err) {
      console.error(`Error in request with params ${cacheKey}:`, err)
      return null
    } finally {
      pendingRequests.delete(cacheKey)
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

  /**
   * Cached version of the request function
   */
  async function cachedCall(params: TParams): Promise<TResult | null> {
    const cacheKey = cacheKeyFn(params)

    const cachedResult = getFromCache(params)
    if (cachedResult) return cachedResult

    const pendingRequest = pendingRequests.get(cacheKey)
    if (pendingRequest) return handlePendingRequest(pendingRequest)

    const newRequest = executeAndCacheCall(params, cacheKey)
    pendingRequests.set(cacheKey, newRequest)
    return newRequest
  }

  /**
   * Clear all cached data
   */
  function clearCache() {
    cache.clear()
  }

  /**
   * Cancel all pending requests
   */
  function cancel() {
    pendingRequests.clear()
  }

  return {
    call: cachedCall,
    clear: clearCache,
    cancel
  }
}
