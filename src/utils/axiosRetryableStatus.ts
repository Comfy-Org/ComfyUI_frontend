import type { AxiosAdapter, AxiosInstance, AxiosResponse } from 'axios'
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

function retryingAdapter(
  adapter: AxiosAdapter,
  { policy, sleep = sleepFor, random }: AxiosRetryableStatusOptions
): AxiosAdapter {
  return async (config) => {
    const signal =
      config.signal instanceof AbortSignal ? config.signal : undefined
    const budgetMs = config.timeout || undefined
    const startedAt = Date.now()
    const remainingMs = () =>
      budgetMs === undefined ? undefined : budgetMs - (Date.now() - startedAt)

    for (let attempt = 1; ; attempt++) {
      const remaining = remainingMs()
      try {
        return await adapter(
          remaining === undefined ? config : { ...config, timeout: remaining }
        )
      } catch (error) {
        const response = axios.isAxiosError(error) ? error.response : undefined
        const delay = response
          ? retryDelayMs({
              method: config.method ?? 'GET',
              status: response.status,
              readRetryAfter: () => retryAfterHeader(response),
              attempt,
              policy,
              random
            })
          : undefined
        const budgetLeft = remainingMs()
        if (delay === undefined) throw error
        if (budgetLeft !== undefined && delay >= budgetLeft) throw error
        await sleep(delay, signal)
      }
    }
  }
}

/**
 * Retries a retryable status around whichever adapter each request selects,
 * so a per-request adapter is covered too. The retry sits below the
 * interceptor chain: each request that reaches the adapter, including the one
 * an interceptor re-issues after a 401 re-mint, gets its own attempt budget,
 * and `timeout` bounds the attempts and the waits between them together.
 */
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
