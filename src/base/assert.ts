export const ASSERTION_FAILURE_PREFIX = '[Assertion failed]: '

export type AssertContext = Record<string, unknown>

export type AssertReporter = (failure: Error, context?: AssertContext) => void

let reporter: AssertReporter | null = null

/**
 * Register a reporter for assertion failures in non-DEV environments.
 * Called once at app startup by platform/ or higher layers to wire in
 * Sentry, toast notifications, etc.
 */
export function setAssertReporter(fn: AssertReporter | null): void {
  reporter = fn
}

/**
 * `datadogRumBeforeSend` reads this as "a tagged copy of the failure will
 * exist", and drops the untagged console echo when it does.
 */
export function hasAssertReporter(): boolean {
  return reporter !== null
}

/**
 * Centralized invariant assertion.
 *
 * - Always: console.error
 * - DEV: throws (surfaces bugs immediately)
 * - Otherwise: delegates to registered reporter (Sentry, toast, etc.)
 *
 * `context` reaches the reporter as structured data. Put high-cardinality or
 * user-derived values there rather than in `message`, which is what the error
 * sinks group on.
 */
export function assert(
  condition: unknown,
  message: string,
  context?: AssertContext
): asserts condition {
  if (condition) return

  const formatted = `${ASSERTION_FAILURE_PREFIX}${message}`
  if (context) {
    console.error(formatted, context)
  } else {
    console.error(formatted)
  }

  const failure = new Error(formatted, context && { cause: context })

  if (import.meta.env.DEV) {
    throw failure
  }

  try {
    reporter?.(failure, context)
  } catch (error) {
    console.error('[Assertion reporter failed]', error)
  }
}
