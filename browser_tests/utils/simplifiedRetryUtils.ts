/**
 * Simplified Retry Utilities
 *
 * Replaces the complex retry state machine with simple, focused utility functions.
 * Preserves all the essential retry logic without framework overhead.
 */

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number) => void
}

export interface RetryResult<T> {
  result: T
  attempts: number
  totalTime: number
}

/**
 * Simple retry utility with exponential backoff
 * Replaces the complex RetryStateMachine with straightforward logic
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    shouldRetry = defaultShouldRetry,
    onRetry
  } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation()
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on last attempt or if error is not retryable
      if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
        throw lastError
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)

      if (onRetry) {
        onRetry(lastError, attempt)
      }

      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Enhanced retry with detailed result information
 */
export async function retryOperationWithDetails<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now()
  let attempts = 0

  const wrappedOperation = async () => {
    attempts++
    return await operation()
  }

  const result = await retryOperation(wrappedOperation, options)

  return {
    result,
    attempts,
    totalTime: Date.now() - startTime
  }
}

/**
 * Default retry strategy - retries on network/server errors, not client errors
 */
export function defaultShouldRetry(error: Error, _attempt: number): boolean {
  const message = error.message.toLowerCase()

  // Don't retry client errors
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404') ||
    message.includes('invalid') ||
    message.includes('unauthorized')
  ) {
    return false
  }

  // Retry network/server errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true
  }

  // Default to retryable for unknown errors
  return true
}

/**
 * Network-aware retry strategy that handles different error types
 */
export function createNetworkRetryStrategy(_options: {
  rateLimitDelayMs?: number
  offlineCheckIntervalMs?: number
}): (error: Error, attempt: number) => boolean {
  return (error: Error, attempt: number): boolean => {
    const message = error.message.toLowerCase()

    // Handle rate limiting
    if (message.includes('429')) {
      // For rate limiting, we might want custom delay logic
      return true
    }

    // Handle offline scenarios
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true // Will retry when network comes back
    }

    // Use default strategy for other cases
    return defaultShouldRetry(error, attempt)
  }
}

/**
 * Retry specifically for network operations with smart error handling
 */
export async function retryNetworkOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions & {
    rateLimitDelayMs?: number
    waitForOnline?: boolean
  } = {}
): Promise<T> {
  const {
    rateLimitDelayMs = 5000,
    waitForOnline = true,
    ...retryOptions
  } = options

  const customShouldRetry = (error: Error, attempt: number): boolean => {
    const message = error.message.toLowerCase()

    // Handle rate limiting with custom delay
    if (message.includes('429')) {
      return attempt < (retryOptions.maxAttempts ?? 3)
    }

    // Handle offline scenarios
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return waitForOnline && attempt < (retryOptions.maxAttempts ?? 3)
    }

    return defaultShouldRetry(error, attempt)
  }

  const customOnRetry = (error: Error, attempt: number) => {
    const message = error.message.toLowerCase()

    if (message.includes('429')) {
      console.warn(
        `[RetryUtils] Rate limited, waiting ${rateLimitDelayMs}ms before retry ${attempt}`
      )
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn(
        `[RetryUtils] Network offline, waiting for connectivity before retry ${attempt}`
      )
    }

    options.onRetry?.(error, attempt)
  }

  return retryOperation(operation, {
    ...retryOptions,
    shouldRetry: customShouldRetry,
    onRetry: customOnRetry
  })
}

/**
 * Utility to wait for network connectivity
 */
export async function waitForOnline(timeoutMs = 30000): Promise<void> {
  if (typeof navigator === 'undefined') {
    return // Server-side environment
  }

  if (navigator.onLine) {
    return // Already online
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Network did not come online within ${timeoutMs}ms`))
    }, timeoutMs)

    const handleOnline = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('online', handleOnline)
    }

    window.addEventListener('online', handleOnline)
  })
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a retry strategy for specific error patterns
 */
export function createCustomRetryStrategy(
  retryablePatterns: string[],
  nonRetryablePatterns: string[] = []
): (error: Error, attempt: number) => boolean {
  return (error: Error, attempt: number): boolean => {
    const message = error.message.toLowerCase()

    // Check non-retryable patterns first
    if (
      nonRetryablePatterns.some((pattern) =>
        message.includes(pattern.toLowerCase())
      )
    ) {
      return false
    }

    // Check retryable patterns
    if (
      retryablePatterns.some((pattern) =>
        message.includes(pattern.toLowerCase())
      )
    ) {
      return true
    }

    // Fall back to default strategy
    return defaultShouldRetry(error, attempt)
  }
}

/**
 * Batch retry operations with different strategies
 */
export async function retryBatch<T>(
  operations: (() => Promise<T>)[],
  options: RetryOptions = {}
): Promise<T[]> {
  const results = await Promise.allSettled(
    operations.map((op) => retryOperation(op, options))
  )

  const failures: Error[] = []
  const successes: T[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successes.push(result.value)
    } else {
      failures.push(
        new Error(`Operation ${index} failed: ${result.reason.message}`)
      )
    }
  })

  if (failures.length > 0) {
    throw new Error(
      `${failures.length}/${operations.length} operations failed: ${failures.map((e) => e.message).join(', ')}`
    )
  }

  return successes
}
