import axios from 'axios'

import { useWidgetStore } from '@/stores/widgetStore'
import type { InputSpec } from '@/types/apiTypes'

export interface CacheEntry<T> {
  data: T[]
  timestamp: number
  loading: boolean
  error: Error | null
  fetchPromise?: Promise<T[]>
  lastErrorTime: number
  retryCount: number
}

const dataCache = new Map<string, CacheEntry<any>>()

const getCacheKey = (inputData: InputSpec): string => {
  const { route, query_params = {}, refresh = 0 } = inputData[1]

  const paramsKey = Object.entries(query_params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  return [route, `r=${refresh}`, paramsKey].join(';')
}

const getBackoff = (retryCount: number) => {
  return Math.min(1000 * Math.pow(2, retryCount), 512)
}

async function fetchData<T>(inputData: InputSpec): Promise<T[]> {
  console.count('[Remove Widget] total requests')
  const { route, response_key, query_params } = inputData[1]
  const res = await axios.get(route, {
    params: query_params,
    validateStatus: (status) => status === 200
  })
  return response_key ? res.data[response_key] : res.data
}

export function useRemoteWidget<T>(inputData: InputSpec) {
  const { refresh = 0 } = inputData[1]
  const isIdempotent = refresh <= 0
  const cacheKey = getCacheKey(inputData)
  const defaultValue = useWidgetStore().getDefaultValue(inputData)

  const setSuccess = (entry: CacheEntry<T>, data: T[]) => {
    entry.retryCount = 0
    entry.lastErrorTime = 0
    entry.error = null
    entry.timestamp = Date.now()
    entry.data = data ?? defaultValue
  }

  const setError = (entry: CacheEntry<T>, error: Error | unknown) => {
    entry.retryCount = (entry.retryCount || 0) + 1
    entry.lastErrorTime = Date.now()
    entry.error = error instanceof Error ? error : new Error(String(error))
    entry.data ??= defaultValue
  }

  const fetchOptions = async () => {
    const entry = dataCache.get(cacheKey)
    const now = Date.now()

    if (entry?.error && entry.lastErrorTime) {
      const isBackingOff =
        now - entry.lastErrorTime < getBackoff(entry.retryCount)
      if (isBackingOff) return entry.data
    }

    const isInitialized = entry?.data && entry.data !== defaultValue
    if (isInitialized) {
      if (isIdempotent) return entry.data

      const isStale = now - entry.timestamp >= refresh
      if (!isStale) return entry.data
    }

    const isFetching = entry?.fetchPromise
    if (isFetching) return entry.fetchPromise

    const currentEntry: CacheEntry<T> = entry || {
      data: defaultValue,
      timestamp: 0,
      loading: false,
      error: null,
      fetchPromise: undefined,
      retryCount: 0,
      lastErrorTime: 0
    }
    dataCache.set(cacheKey, currentEntry)

    try {
      currentEntry.loading = true
      currentEntry.error = null

      currentEntry.fetchPromise = fetchData<T>(inputData)
      const data = await currentEntry.fetchPromise

      setSuccess(currentEntry, data)
      return data
    } catch (err) {
      setError(currentEntry, err)
      return currentEntry.data
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
