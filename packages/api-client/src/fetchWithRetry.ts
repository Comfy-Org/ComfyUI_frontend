import type { RetryPolicy } from './retryPolicy'
import {
  canRetryMethod,
  canRetrySignInRefusal,
  nextRetry,
  signInRefusalDelayMs,
  sleep as sleepFor
} from './retryPolicy'
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

async function fetchWriteAfterRefusal(
  input: RequestInfo | URL,
  init: RequestInit,
  method: string,
  options: RetryingFetchOptions
): Promise<Response> {
  const { policy, fetchImpl = fetch, sleep = sleepFor, random } = options
  const replay =
    input instanceof Request && input.body !== null ? input.clone() : input
  const first = await fetchImpl(input, init)
  const delayMs = await signInRefusalDelayMs({
    method,
    status: first.status,
    readRetryAfter: () => first.headers.get('Retry-After'),
    readBody: () => first.clone().json(),
    policy,
    random
  })
  if (delayMs === undefined) return first

  const signal = requestSignal(input, init)
  await first.body?.cancel().catch(() => undefined)
  await sleep(delayMs, signal)
  const settle = (end: StatusRetryEnd, finalStatus = first.status) =>
    trackStatusRetry({
      transport: 'fetch',
      method,
      url: () => (input instanceof Request ? input.url : String(input)),
      end,
      attempts: 2,
      finalStatus,
      retryScheduled: true
    })
  let second: Response
  try {
    second = await fetchImpl(replay, init)
  } catch (error) {
    settle(abortEnd(signal))
    throw error
  }
  settle('answered', second.status)
  return second
}

/**
 * `fetch` that retries retryable statuses on idempotent methods, honoring
 * `Retry-After`; a policy may opt in a write the sign-in check refused.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryingFetchOptions = {}
): Promise<Response> {
  const { policy, fetchImpl = fetch, sleep = sleepFor, random } = options
  const method = requestMethod(input, init)
  if (canRetrySignInRefusal(method, policy) && isReplayable(input, init)) {
    return fetchWriteAfterRefusal(input, init, method, options)
  }
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
