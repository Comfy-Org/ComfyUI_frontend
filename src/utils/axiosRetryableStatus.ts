import type { AxiosInstance, AxiosResponse } from 'axios'
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

/**
 * Wraps the client's adapter so a retryable status is retried below the
 * interceptor chain. Each request that reaches the adapter, including the one
 * an interceptor re-issues after a 401 re-mint, gets its own attempt budget.
 */
export function attachRetryableStatusRetry(
  client: AxiosInstance,
  options: AxiosRetryableStatusOptions = {}
): void {
  const { policy, sleep = sleepFor, random } = options
  const adapter = axios.getAdapter(client.defaults.adapter)

  client.defaults.adapter = async (config) => {
    const signal =
      config.signal instanceof AbortSignal ? config.signal : undefined
    for (let attempt = 1; ; attempt++) {
      try {
        return await adapter(config)
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
        if (delay === undefined) throw error
        await sleep(delay, signal)
      }
    }
  }
}
