import type {
  AxiosAdapter,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosError } from 'axios'

import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import type { RetryPolicy } from '@comfyorg/api-client/retryPolicy'
import { nextRetry, sleep as sleepFor } from '@comfyorg/api-client/retryPolicy'
import type { StatusRetryEnd } from '@comfyorg/api-client/statusRetryTelemetry'
import {
  abortEnd,
  endForStop,
  trackStatusRetry
} from '@comfyorg/api-client/statusRetryTelemetry'

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
    ? combineAbortSignals([signal, controller.signal])
    : controller.signal
}

function fitsBudget(delay: number, remaining: number | undefined): boolean {
  return remaining === undefined || delay < remaining
}

async function runAttempt(
  adapter: AxiosAdapter,
  config: InternalAxiosRequestConfig,
  remaining: number | undefined
): Promise<AxiosResponse> {
  try {
    const response = await adapter(
      remaining === undefined
        ? config
        : { ...config, timeout: Math.max(1, remaining) }
    )
    response.config = config
    return response
  } catch (error) {
    if (axios.isAxiosError(error) && error.config) error.config = config
    throw error
  }
}

function isTimeout(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (error.code === AxiosError.ETIMEDOUT) return true
  return (
    error.code === AxiosError.ECONNABORTED && /timeout/i.test(error.message)
  )
}

function noResponseEnd(error: unknown): StatusRetryEnd {
  if (isTimeout(error)) return 'timeout'
  const cancelled =
    axios.isCancel(error) ||
    (axios.isAxiosError(error) &&
      (error.code === AxiosError.ERR_CANCELED ||
        error.code === AxiosError.ECONNABORTED))
  return cancelled ? 'cancelled' : 'network'
}

interface StatusRetryTracker {
  scheduled(status: number): void
  settle(end: StatusRetryEnd, attempts: number, status?: number): void
}

function statusRetryTracker(
  config: InternalAxiosRequestConfig
): StatusRetryTracker {
  let lastRetryStatus: number | undefined
  return {
    scheduled(status) {
      lastRetryStatus = status
    },
    settle(end, attempts, status) {
      trackStatusRetry({
        transport: 'axios',
        method: config.method ?? 'GET',
        url: () => axios.getUri(config),
        end,
        attempts,
        finalStatus: status ?? lastRetryStatus,
        retryScheduled: lastRetryStatus !== undefined
      })
    }
  }
}

function delayOrRethrow(
  error: unknown,
  config: InternalAxiosRequestConfig,
  attempt: number,
  remaining: number | undefined,
  tracker: StatusRetryTracker,
  { policy, random }: AxiosRetryableStatusOptions
): number {
  const failed = axios.isAxiosError(error) ? error.response : undefined
  if (!failed) {
    tracker.settle(noResponseEnd(error), attempt)
    throw error
  }
  const decision = nextRetry({
    method: config.method ?? 'GET',
    status: failed.status,
    readRetryAfter: () => retryAfterHeader(failed),
    attempt,
    policy,
    random
  })
  if (!decision.retry) {
    tracker.settle(endForStop(decision.reason), attempt, failed.status)
    throw error
  }
  tracker.scheduled(failed.status)
  if (!fitsBudget(decision.delayMs, remaining)) {
    tracker.settle('timeout', attempt)
    throw error
  }
  return decision.delayMs
}

function retryingAdapter(
  adapter: AxiosAdapter,
  options: AxiosRetryableStatusOptions
): AxiosAdapter {
  const { sleep = sleepFor } = options

  async function pause(
    delay: number,
    config: InternalAxiosRequestConfig,
    settleAbort: (signal: AbortSignal | undefined) => void
  ) {
    const signal = cancellationSignal(config)
    try {
      await sleep(delay, signal)
    } catch (error) {
      settleAbort(signal)
      if (!signal?.aborted) throw error
      throw new axios.CanceledError('canceled', config)
    }
  }

  return async (config) => {
    if (config.__skipStatusRetry) return adapter(config)
    const remainingMs = timeBudget(config.timeout)
    const tracker = statusRetryTracker(config)
    let lastError: unknown

    for (let attempt = 1; ; attempt++) {
      const remaining = remainingMs()
      if (attempt > 1 && remaining !== undefined && remaining <= 0) {
        tracker.settle('timeout', attempt - 1)
        throw lastError
      }
      try {
        const response = await runAttempt(adapter, config, remaining)
        tracker.settle('answered', attempt, response.status)
        return response
      } catch (error) {
        lastError = error
        const delay = delayOrRethrow(
          error,
          config,
          attempt,
          remainingMs(),
          tracker,
          options
        )
        await pause(delay, config, (signal) =>
          tracker.settle(abortEnd(signal), attempt)
        )
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
