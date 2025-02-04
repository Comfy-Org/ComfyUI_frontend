import axios from 'axios'

import { useWidgetStore } from '@/stores/widgetStore'
import type { InputSpec } from '@/types/apiTypes'

interface RemoteWidgetOptions {
  route: string
  refresh: number
  backoff: number
  response_key?: string
  query_params?: Record<string, string>
}

interface CacheEntry<T> {
  data: T[]
  timestamp: number
  loading: boolean
  error: Error | null
  fetchPromise?: Promise<T[]>
  lastErrorTime?: number
}

// Global cache for memoizing fetches
const dataCache = new Map<string, CacheEntry<any>>()

function getCacheKey(options: RemoteWidgetOptions): string {
  return JSON.stringify({ route: options.route, params: options.query_params })
}

async function fetchData<T>(options: RemoteWidgetOptions): Promise<T[]> {
  console.count('[Remove Widget] total requests')
  const { route, response_key, query_params } = options
  const res = await axios.get(route, {
    params: query_params,
    validateStatus: (status) => status === 200
  })
  return response_key ? res.data[response_key] : res.data
}

export function useRemoteWidget<T>(inputData: InputSpec) {
  const widgetOptions: RemoteWidgetOptions = {
    route: inputData[1].route,
    refresh: inputData[1].refresh ?? 0,
    backoff: inputData[1].backoff ?? 2048,
    response_key: inputData[1].response_key,
    query_params: inputData[1].query_params
  }

  const cacheKey = getCacheKey(widgetOptions)
  const defaultValue = useWidgetStore().getDefaultValue(inputData)

  const fetchOptions = async () => {
    const entry = dataCache.get(cacheKey)
    const now = Date.now()

    const isInitialized = entry?.data.length
    if (isInitialized) {
      const isIdempotent = widgetOptions.refresh <= 0
      if (isIdempotent) return entry.data

      const isStale = now - entry.timestamp > widgetOptions.refresh
      if (!isStale) return entry.data

      const isBackingOff =
        entry.error &&
        entry.lastErrorTime &&
        now - entry.lastErrorTime > widgetOptions.backoff
      if (isBackingOff) return entry.data
    }

    const isFetching = entry?.fetchPromise
    if (isFetching) return entry.fetchPromise

    const currentEntry = entry || {
      data: [],
      timestamp: 0,
      loading: false,
      error: null
    }
    dataCache.set(cacheKey, currentEntry)

    try {
      currentEntry.loading = true
      currentEntry.error = null

      currentEntry.fetchPromise = fetchData<T>(widgetOptions)
      const data = await currentEntry.fetchPromise

      currentEntry.data = data
      currentEntry.timestamp = now
      currentEntry.lastErrorTime = undefined

      return data
    } catch (err) {
      currentEntry.error = err instanceof Error ? err : new Error(String(err))
      currentEntry.lastErrorTime = now
      throw currentEntry.error
    } finally {
      currentEntry.loading = false
      currentEntry.fetchPromise = undefined
    }
  }

  return {
    getCacheKey: () => cacheKey,
    getCacheEntry: () => dataCache.get(cacheKey),
    clearCache: () => dataCache.delete(cacheKey),
    fetchOptions,

    defaultValue
  }
}
