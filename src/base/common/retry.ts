/**
 * Centralized retry utility with exponential backoff and jitter.
 *
 * Implements AWS-recommended retry patterns:
 * @see https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
 */

/**
 * Jitter strategy for retry delays.
 * - `false`: No jitter, pure exponential backoff
 * - `true` | `'full'`: Full jitter - random value between 0 and calculated delay
 * - `'decorrelated'`: Decorrelated jitter - each delay based on previous delay
 */
export type JitterStrategy = boolean | "full" | "decorrelated";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Jitter strategy to prevent thundering herd (default: 'full') */
  jitter?: JitterStrategy;
  /**
   * Predicate to determine if retry should continue.
   * Return false to stop retrying immediately.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry attempt with the delay that will be used */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Called when all retries are exhausted without success */
  onExhausted?: (error: unknown, totalAttempts: number) => void;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
}

export class RetryAbortedError extends Error {
  constructor(message = "Retry aborted") {
    super(message);
    this.name = "RetryAbortedError";
  }
}

export class RetriesExhaustedError extends Error {
  constructor(
    message: string,
    public readonly lastError: unknown,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = "RetriesExhaustedError";
  }
}

/**
 * Calculate delay with jitter for a given attempt.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @param jitter - Jitter strategy
 * @param previousDelay - Previous delay (used for decorrelated jitter)
 * @returns Calculated delay in milliseconds
 */
export function calculateDelayWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: JitterStrategy,
  previousDelay?: number,
): number {
  // Pure exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  if (jitter === false) {
    return cappedDelay;
  }

  if (jitter === "decorrelated" && previousDelay !== undefined) {
    // Decorrelated jitter: random between base and 3 * previous
    const minDelay = baseDelayMs;
    const maxDecoDelay = Math.min(previousDelay * 3, maxDelayMs);
    return minDelay + Math.random() * (maxDecoDelay - minDelay);
  }

  // Full jitter (default): random between 0 and capped delay
  return Math.random() * cappedDelay;
}

/**
 * Sleep for a specified duration with abort support.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryAbortedError());
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new RetryAbortedError());
      },
      { once: true },
    );
  });
}

/**
 * Retry an async operation with exponential backoff and jitter.
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetchData(),
 *   {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *     jitter: 'full',
 *     shouldRetry: (err) => isTransientError(err),
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry ${attempt} in ${delay}ms`)
 *     }
 *   }
 * )
 * ```
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws {RetryAbortedError} If aborted via signal
 * @throws {RetriesExhaustedError} If all retries fail and shouldRetry returns true
 * @throws The original error if shouldRetry returns false
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitter = "full",
    shouldRetry = () => true,
    onRetry,
    onExhausted,
    signal,
  } = options;

  let lastError: unknown;
  let previousDelay = baseDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      throw new RetryAbortedError();
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries;
      const shouldContinue = !isLastAttempt && shouldRetry(error, attempt);

      if (!shouldContinue) {
        if (isLastAttempt) {
          onExhausted?.(error, attempt + 1);
          throw new RetriesExhaustedError(
            `All ${attempt + 1} attempts failed`,
            error,
            attempt + 1,
          );
        }
        // shouldRetry returned false - throw original error
        throw error;
      }

      // Calculate delay for next attempt
      const delay = calculateDelayWithJitter(
        attempt,
        baseDelayMs,
        maxDelayMs,
        jitter,
        previousDelay,
      );
      previousDelay = delay;

      onRetry?.(error, attempt + 1, delay);

      await sleep(delay, signal);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Default retry options suitable for most use cases.
 */
export const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "shouldRetry" | "onRetry" | "onExhausted" | "signal">
> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: "full",
};
