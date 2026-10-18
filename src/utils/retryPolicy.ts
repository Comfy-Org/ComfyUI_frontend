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

/**
 * How long to wait before the next attempt, or `undefined` to stop retrying:
 * the request is not retryable, attempts are spent, or the server asked to
 * wait longer than the policy allows.
 */
export function retryDelayMs({
  method,
  status,
  readRetryAfter,
  attempt,
  policy = DEFAULT_RETRY_POLICY,
  random = Math.random,
  now = Date.now
}: RetryDecisionInput): number | undefined {
  if (attempt >= policy.maxAttempts) return undefined
  if (!isRetryableStatus(status)) return undefined
  if (!policy.retryNonIdempotent && !isIdempotentMethod(method)) {
    return undefined
  }

  const retryAfterMs = parseRetryAfterMs(readRetryAfter(), now())
  if (retryAfterMs !== undefined && retryAfterMs > policy.maxDelayMs) {
    return undefined
  }

  const ceiling = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** (attempt - 1)
  )
  const jittered = ceiling / 2 + (random() * ceiling) / 2
  return Math.max(jittered, retryAfterMs ?? 0)
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
