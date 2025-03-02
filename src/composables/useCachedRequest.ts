import QuickLRU from '@alloc/quick-lru'

import { paramsToCacheKey } from '@/utils/formatUtil'

/**
 * Options for configuring the cached API
 */
export interface CachedApiOptions {
  /** Maximum number of items to store in the cache (default: 50) */
  maxSize?: number
  /** Function to generate a cache key from parameters */
  cacheKeyFn?: (params: unknown) => string
}

/**
 * Composable that creates a cached version of an API function with LRU caching and request deduplication
 *
 * @param apiCall The API function to cache
 * @param options Configuration options for the cache
 * @returns A cached version of the API function and a function to clear the cache
 */
export function useCachedRequest<TParams, TResult>(
  apiCall: (params: TParams) => Promise<TResult | null>,
  options: CachedApiOptions = {}
) {
  const { maxSize = 50, cacheKeyFn = paramsToCacheKey } = options

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
      const result = await apiCall(params)
      if (result) {
        cache.set(cacheKey, result)
      }
      return result
    } catch (err) {
      console.error(`Error in API call with params ${cacheKey}:`, err)
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
   * Cached version of the call
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
