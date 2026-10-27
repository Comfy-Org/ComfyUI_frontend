import type { RetryPolicy } from '@/utils/retryPolicy'
import {
  canRetryMethod,
  retryDelayMs,
  sleep as sleepFor
} from '@/utils/retryPolicy'

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export interface RetryingFetchOptions {
  readonly policy?: RetryPolicy
  readonly fetchImpl?: FetchLike
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  readonly random?: () => number
}

function requestMethod(input: RequestInfo | URL, init: RequestInit): string {
  return init.method ?? (input instanceof Request ? input.method : 'GET')
}

function requestSignal(
  input: RequestInfo | URL,
  init: RequestInit
): AbortSignal | undefined {
  return init.signal ?? (input instanceof Request ? input.signal : undefined)
}

function timedOut(signal: AbortSignal | undefined): boolean {
  return (
    signal?.aborted === true &&
    signal.reason instanceof DOMException &&
    signal.reason.name === 'TimeoutError'
  )
}

function isReplayable(input: RequestInfo | URL, init: RequestInit): boolean {
  return (
    !(init.body instanceof ReadableStream) &&
    !(input instanceof Request && input.bodyUsed)
  )
}

/** `fetch` that retries retryable statuses on idempotent methods, honoring `Retry-After`. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryingFetchOptions = {}
): Promise<Response> {
  const { policy, fetchImpl = fetch, sleep = sleepFor, random } = options
  const method = requestMethod(input, init)
  if (!canRetryMethod(method, policy) || !isReplayable(input, init)) {
    return fetchImpl(input, init)
  }

  const signal = requestSignal(input, init)
  const template =
    input instanceof Request && input.body !== null ? input.clone() : undefined

  for (let attempt = 1; ; attempt++) {
    const response = await fetchImpl(template?.clone() ?? input, init)
    const delay = retryDelayMs({
      method,
      status: response.status,
      readRetryAfter: () => response.headers.get('Retry-After'),
      attempt,
      policy,
      random
    })
    if (delay === undefined) return response
    try {
      await sleep(delay, signal)
    } catch (error) {
      if (timedOut(signal)) return response
      throw error
    }
    await response.body?.cancel()
  }
}

/** Wraps a url-based send so it retries like {@link fetchWithRetry}. */
export function retryingSend(
  send: (url: string, init: RequestInit) => Promise<Response>
): (url: string, init: RequestInit) => Promise<Response> {
  return (url, init) =>
    fetchWithRetry(url, init, {
      fetchImpl: (input, attemptInit) => send(String(input), attemptInit ?? {})
    })
}
