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

function cancellationSignal(
  config: InternalAxiosRequestConfig
): AbortSignal | undefined {
  const signal =
    config.signal instanceof AbortSignal ? config.signal : undefined
  if (!config.cancelToken) return signal

  const controller = new AbortController()
  void config.cancelToken.promise.then(() => controller.abort())
  return signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal
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

  async function pause(delay: number, config: InternalAxiosRequestConfig) {
    const signal = cancellationSignal(config)
    try {
      await sleep(delay, signal)
    } catch (error) {
      if (!signal?.aborted) throw error
      throw new axios.CanceledError('canceled', config)
    }
  }

  return async (config) => {
    const remainingMs = timeBudget(config.timeout)
    let lastError: unknown

    for (let attempt = 1; ; attempt++) {
      const remaining = remainingMs()
      if (remaining !== undefined && remaining <= 0) throw lastError
      try {
        const response = await adapter(
          remaining === undefined ? config : { ...config, timeout: remaining }
        )
        response.config = config
        return response
      } catch (error) {
        if (axios.isAxiosError(error) && error.config) error.config = config
        lastError = error
        const delay = waitBeforeRetry(error, config, attempt)
        const left = remainingMs()
        if (delay === undefined || (left !== undefined && delay >= left)) {
          throw error
        }
        await pause(delay, config)
      }
    }
  }
}

const retrying = new WeakSet<AxiosAdapter>()

/** Retries retryable statuses around each request's adapter, within its `timeout`. */
export function attachRetryableStatusRetry(
  client: AxiosInstance,
  options: AxiosRetryableStatusOptions = {}
): void {
  client.interceptors.request.use((config) => {
    const selected = config.adapter ?? client.defaults.adapter
    if (typeof selected === 'function' && retrying.has(selected)) return config

    const adapter = retryingAdapter(axios.getAdapter(selected), options)
    retrying.add(adapter)
    config.adapter = adapter
    return config
  })
}
