import axios from 'axios'

import { useWidgetStore } from '@/stores/widgetStore'
import type { InputSpec, RemoteWidgetConfig } from '@/types/apiTypes'

export interface CacheEntry<T> {
  data: T[]
  timestamp: number
  loading: boolean
  error: Error | null
  fetchPromise?: Promise<T[]>
  controller?: AbortController
  lastErrorTime: number
  retryCount: number
}

const dataCache = new Map<string, CacheEntry<any>>()

const createCacheKey = (config: RemoteWidgetConfig): string => {
  const { route, query_params = {}, refresh = 0 } = config

  const paramsKey = Object.entries(query_params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  return [route, `r=${refresh}`, paramsKey].join(';')
}

const getBackoff = (retryCount: number) => {
  return Math.min(1000 * Math.pow(2, retryCount), 512)
}

async function fetchData<T>(
  config: RemoteWidgetConfig,
  controller: AbortController
): Promise<T[]> {
  const { route, response_key, query_params } = config
  const res = await axios.get(route, {
    params: query_params,
    signal: controller.signal,
    validateStatus: (status) => status === 200
  })
  return response_key ? res.data[response_key] : res.data
}

export function useRemoteWidget<T>(inputData: InputSpec) {
  const config: RemoteWidgetConfig = inputData[1].remote
  const { refresh = 0 } = config
  const isPermanent = refresh <= 0
  const cacheKey = createCacheKey(config)
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

  const isInitialized = () => {
    const entry = dataCache.get(cacheKey)
    return entry?.data && entry.timestamp > 0
  }

  const isStale = () => {
    const entry = dataCache.get(cacheKey)
    return entry?.timestamp && Date.now() - entry.timestamp >= refresh
  }

  const isFetching = () => {
    const entry = dataCache.get(cacheKey)
    return entry?.fetchPromise
  }

  const isBackingOff = () => {
    const entry = dataCache.get(cacheKey)
    return (
      entry?.error &&
      entry.lastErrorTime &&
      Date.now() - entry.lastErrorTime < getBackoff(entry.retryCount)
    )
  }

  const fetchOptions = async () => {
    const entry = dataCache.get(cacheKey)

    const isValid = isInitialized() && (isPermanent || !isStale())
    if (isValid || isBackingOff()) return entry!.data
    if (isFetching()) return entry!.fetchPromise

    const currentEntry: CacheEntry<T> = entry || {
      data: defaultValue,
      timestamp: 0,
      loading: false,
      error: null,
      fetchPromise: undefined,
      controller: undefined,
      retryCount: 0,
      lastErrorTime: 0
    }
    dataCache.set(cacheKey, currentEntry)

    try {
      currentEntry.loading = true
      currentEntry.error = null
      currentEntry.controller = new AbortController()

      currentEntry.fetchPromise = fetchData<T>(config, currentEntry.controller)
      const data = await currentEntry.fetchPromise

      setSuccess(currentEntry, data)
      return currentEntry.data
    } catch (err) {
      setError(currentEntry, err)
      return currentEntry.data
    } finally {
      currentEntry.loading = false
      currentEntry.fetchPromise = undefined
      currentEntry.controller = undefined
    }
  }

  return {
    getCacheKey: () => cacheKey,
    getCacheEntry: () => dataCache.get(cacheKey),
    forceUpdate: () => {
      const entry = dataCache.get(cacheKey)
      if (entry?.fetchPromise) entry.controller?.abort() // Abort in-flight request
      dataCache.delete(cacheKey)
    },
    fetchOptions,
    defaultValue
  }
}
