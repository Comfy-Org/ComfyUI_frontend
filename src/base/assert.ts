type AssertReporter = (message: string) => void

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
 * Centralized invariant assertion.
 *
 * - Always: console.error
 * - DEV: throws (surfaces bugs immediately)
 * - Otherwise: delegates to registered reporter (Sentry, toast, etc.)
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (condition) return

  const formatted = `[Assertion failed]: ${message}`
  console.error(formatted)

  if (import.meta.env.DEV) {
    throw new Error(formatted)
  }

  try {
    reporter?.(formatted)
  } catch (error) {
    console.error('[Assertion reporter failed]', error)
  }
}
