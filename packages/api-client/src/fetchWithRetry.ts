import type { RetryPolicy } from './retryPolicy'
import { canRetryMethod, nextRetry, sleep as sleepFor } from './retryPolicy'
import type { StatusRetryEnd } from './statusRetryTelemetry'
import { abortEnd, endForStop, trackStatusRetry } from './statusRetryTelemetry'

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

  let lastRetryStatus: number | undefined
  const settle = (end: StatusRetryEnd, attempts: number, status?: number) =>
    trackStatusRetry({
      transport: 'fetch',
      method,
      url: () => (input instanceof Request ? input.url : String(input)),
      end,
      attempts,
      finalStatus: status ?? lastRetryStatus,
      retryScheduled: lastRetryStatus !== undefined
    })

  for (let attempt = 1; ; attempt++) {
    let response: Response
    try {
      response = await fetchImpl(template?.clone() ?? input, init)
    } catch (error) {
      settle(abortEnd(signal), attempt)
      throw error
    }
    const decision = nextRetry({
      method,
      status: response.status,
      readRetryAfter: () => response.headers.get('Retry-After'),
      attempt,
      policy,
      random
    })
    if (!decision.retry) {
      settle(endForStop(decision.reason), attempt, response.status)
      return response
    }
    lastRetryStatus = response.status
    await response.body?.cancel().catch(() => undefined)
    try {
      await sleep(decision.delayMs, signal)
    } catch (error) {
      settle(abortEnd(signal), attempt)
      throw error
    }
  }
}

/** Wraps a url-based send so it retries like {@link fetchWithRetry}. */
export function retryingSend(
  send: (url: string, init: RequestInit) => Promise<Response>,
  policy?: RetryPolicy
): (url: string, init: RequestInit) => Promise<Response> {
  return (url, init) =>
    fetchWithRetry(url, init, {
      policy,
      fetchImpl: (input, attemptInit) => send(String(input), attemptInit ?? {})
    })
}
