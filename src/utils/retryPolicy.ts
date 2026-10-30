export interface RetryPolicy {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  readonly retryNonIdempotent: boolean
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  retryNonIdempotent: false
}

/** Sends once: for callers that already retry on their own backoff. */
export const NO_RETRY_POLICY: RetryPolicy = {
  ...DEFAULT_RETRY_POLICY,
  maxAttempts: 1
}

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504])
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'OPTIONS'
])

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status)
}

function isIdempotentMethod(method: string): boolean {
  return IDEMPOTENT_METHODS.has(method.toUpperCase())
}

export function canRetryMethod(
  method: string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  return policy.retryNonIdempotent || isIdempotentMethod(method)
}

/** Milliseconds a `Retry-After` header asks for (delta-seconds or HTTP-date). */
export function parseRetryAfterMs(
  value: string | null | undefined,
  now: number = Date.now()
): number | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  if (!/[a-z]/i.test(trimmed)) return undefined
  const at = Date.parse(trimmed)
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}

interface RetryDecisionInput {
  readonly method: string
  readonly status: number
  readonly readRetryAfter: () => string | null | undefined
  readonly attempt: number
  readonly policy?: RetryPolicy
  readonly random?: () => number
  readonly now?: () => number
}

/** Why {@link nextRetry} stopped instead of scheduling another attempt. */
export type RetryStopReason =
  | 'not_retryable'
  | 'attempts_spent'
  | 'retry_after_too_long'

export type RetryDecision =
  | { readonly retry: true; readonly delayMs: number }
  | { readonly retry: false; readonly reason: RetryStopReason }

/** Whether to send another attempt, and after how long. */
export function nextRetry({
  method,
  status,
  readRetryAfter,
  attempt,
  policy = DEFAULT_RETRY_POLICY,
  random = Math.random,
  now = Date.now
}: RetryDecisionInput): RetryDecision {
  if (!isRetryableStatus(status) || !canRetryMethod(method, policy)) {
    return { retry: false, reason: 'not_retryable' }
  }
  if (attempt >= policy.maxAttempts) {
    return { retry: false, reason: 'attempts_spent' }
  }

  const retryAfterMs = parseRetryAfterMs(readRetryAfter(), now())
  if (retryAfterMs !== undefined && retryAfterMs > policy.maxDelayMs) {
    return { retry: false, reason: 'retry_after_too_long' }
  }

  const ceiling = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** (attempt - 1)
  )
  const jittered = ceiling / 2 + (random() * ceiling) / 2
  if (retryAfterMs === undefined) return { retry: true, delayMs: jittered }
  const spread = (random() * ceiling) / 2
  return {
    retry: true,
    delayMs: Math.min(
      policy.maxDelayMs,
      Math.max(jittered, retryAfterMs + spread)
    )
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
