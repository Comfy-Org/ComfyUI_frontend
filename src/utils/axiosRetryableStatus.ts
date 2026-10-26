import type {
  AxiosAdapter,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import axios from 'axios'

import type { RetryPolicy } from '@/utils/retryPolicy'
import { retryDelayMs, sleep as sleepFor } from '@/utils/retryPolicy'

export interface AxiosRetryableStatusOptions {
  readonly policy?: RetryPolicy
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  readonly random?: () => number
}

function retryAfterHeader(response: AxiosResponse): string | undefined {
  const value = response.headers['retry-after']
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

function timeBudget(timeoutMs: number | undefined) {
  const startedAt = Date.now()
  return () => (timeoutMs ? timeoutMs - (Date.now() - startedAt) : undefined)
}

function retryingAdapter(
  adapter: AxiosAdapter,
  { policy, sleep = sleepFor, random }: AxiosRetryableStatusOptions
): AxiosAdapter {
  function waitBeforeRetry(
    error: unknown,
    config: InternalAxiosRequestConfig,
    attempt: number
  ): number | undefined {
    const response = axios.isAxiosError(error) ? error.response : undefined
    if (!response) return undefined
    return retryDelayMs({
      method: config.method ?? 'GET',
      status: response.status,
      readRetryAfter: () => retryAfterHeader(response),
      attempt,
      policy,
      random
    })
  }

  return async (config) => {
    const signal =
      config.signal instanceof AbortSignal ? config.signal : undefined
    const remainingMs = timeBudget(config.timeout)

    for (let attempt = 1; ; attempt++) {
      const remaining = remainingMs()
      try {
        return await adapter(
          remaining === undefined ? config : { ...config, timeout: remaining }
        )
      } catch (error) {
        const delay = waitBeforeRetry(error, config, attempt)
        const left = remainingMs()
        if (delay === undefined || (left !== undefined && delay >= left)) {
          throw error
        }
        await sleep(delay, signal)
      }
    }
  }
}

/** Retries retryable statuses around each request's adapter, within its `timeout`. */
export function attachRetryableStatusRetry(
  client: AxiosInstance,
  options: AxiosRetryableStatusOptions = {}
): void {
  const retrying = new WeakSet<AxiosAdapter>()

  client.interceptors.request.use((config) => {
    const selected = config.adapter ?? client.defaults.adapter
    if (typeof selected === 'function' && retrying.has(selected)) return config

    const adapter = retryingAdapter(axios.getAdapter(selected), options)
    retrying.add(adapter)
    config.adapter = adapter
    return config
  })
}
