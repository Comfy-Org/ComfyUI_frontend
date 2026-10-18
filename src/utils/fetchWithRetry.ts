import type { RetryPolicy } from '@/utils/retryPolicy'
import { retryDelayMs, sleep as sleepFor } from '@/utils/retryPolicy'

export interface RetryingFetchOptions {
  readonly policy?: RetryPolicy
  readonly fetchImpl?: typeof fetch
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

/**
 * `fetch` that re-issues idempotent requests the server answered with a
 * retryable status, honoring `Retry-After`. Returns the last response once
 * attempts are spent; never retries a non-idempotent method unless the policy
 * opts in.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryingFetchOptions = {}
): Promise<Response> {
  const { policy, fetchImpl = fetch, sleep = sleepFor, random } = options
  const method = requestMethod(input, init)
  const signal = requestSignal(input, init)

  for (let attempt = 1; ; attempt++) {
    const response = await fetchImpl(input, init)
    const delay = retryDelayMs({
      method,
      status: response.status,
      readRetryAfter: () => response.headers.get('Retry-After'),
      attempt,
      policy,
      random
    })
    if (delay === undefined) return response
    await response.body?.cancel()
    await sleep(delay, signal)
  }
}
