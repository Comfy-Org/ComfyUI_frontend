export interface RetryPolicy {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  readonly retryNonIdempotent: boolean
  /** Send a write once more after {@link isSignInCheckRefusal}; cloud only. */
  readonly retrySignInRefusal: boolean
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  retryNonIdempotent: false,
  retrySignInRefusal: false
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

/** `policy`, also sending a write once more after a sign-in check refusal. */
export function withSignInRefusalRetry(
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): RetryPolicy {
  return { ...policy, retrySignInRefusal: true }
}

/** Whether a sign-in check refusal is the only answer that can resend `method`. */
export function canRetrySignInRefusal(
  method: string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  return policy.retrySignInRefusal && !canRetryMethod(method, policy)
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

/** The `message` cloud's sign-in check sends when it could not check the credential. */
const SIGN_IN_CHECK_UNAVAILABLE = 'authentication service unavailable'

/** A write refused by the sign-in check is sent at most once more. */
const SIGN_IN_REFUSAL_MAX_ATTEMPTS = 2

interface SignInRefusalInput {
  readonly status: number
  readonly readRetryAfter: () => string | null | undefined
  /** The response body, parsed or as text; read only for a 503 with `Retry-After`. */
  readonly readBody: () => unknown
}

/**
 * Whether a 503 is cloud's sign-in check refusing the request before any
 * handler ran: it carries a `Retry-After` and a JSON body whose `message` is
 * {@link SIGN_IN_CHECK_UNAVAILABLE}. The server did nothing with the request,
 * so sending it again is safe for any method. A body that does not parse is
 * not a match.
 */
export async function isSignInCheckRefusal({
  status,
  readRetryAfter,
  readBody
}: SignInRefusalInput): Promise<boolean> {
  if (status !== 503) return false
  try {
    if (parseRetryAfterMs(readRetryAfter()) === undefined) return false
    const body: unknown = await readBody()
    const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      parsed.message === SIGN_IN_CHECK_UNAVAILABLE
    )
  } catch {
    return false
  }
}

interface RetryDecisionInput {
  readonly method: string
  readonly status: number
  readonly readRetryAfter: () => string | null | undefined
  readonly attempt: number
  readonly policy?: RetryPolicy
  readonly random?: () => number
  readonly now?: () => number
  /** The answer is a {@link isSignInCheckRefusal}; a write the policy opts in may be sent once more. */
  readonly signInRefusal?: boolean
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
  now = Date.now,
  signInRefusal = false
}: RetryDecisionInput): RetryDecision {
  const methodRetries = canRetryMethod(method, policy)
  const refusalRetries = signInRefusal && policy.retrySignInRefusal
  if (!isRetryableStatus(status) || !(methodRetries || refusalRetries)) {
    return { retry: false, reason: 'not_retryable' }
  }
  const maxAttempts = methodRetries
    ? policy.maxAttempts
    : Math.min(policy.maxAttempts, SIGN_IN_REFUSAL_MAX_ATTEMPTS)
  if (attempt >= maxAttempts) {
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

interface RefusedWriteInput extends SignInRefusalInput {
  readonly method: string
  readonly policy?: RetryPolicy
  readonly random?: () => number
}

/**
 * Milliseconds to wait before sending a write the sign-in check refused once
 * more, or `undefined` when nothing more is sent: the policy does not opt in,
 * the answer is not a refusal, or its `Retry-After` is past the cap.
 */
export async function signInRefusalDelayMs({
  method,
  policy = DEFAULT_RETRY_POLICY,
  random,
  ...answer
}: RefusedWriteInput): Promise<number | undefined> {
  if (!canRetrySignInRefusal(method, policy)) return undefined
  if (!(await isSignInCheckRefusal(answer))) return undefined
  const decision = nextRetry({
    method,
    status: answer.status,
    readRetryAfter: answer.readRetryAfter,
    attempt: 1,
    policy,
    random,
    signInRefusal: true
  })
  return decision.retry ? decision.delayMs : undefined
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
