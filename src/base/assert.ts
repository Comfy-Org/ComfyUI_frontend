type AssertReporter = (message: string) => void

let reporter: AssertReporter | null = null

/**
 * Register a reporter for assertion failures in non-DEV environments.
 * Called once at app startup by platform/ or higher layers to wire in
 * Sentry, toast notifications, etc.
 */
export function setAssertReporter(fn: AssertReporter): void {
  reporter = fn
}

/**
 * Centralized invariant assertion.
 *
 * - Always: console.error
 * - DEV: throws (surfaces bugs immediately)
 * - Otherwise: delegates to registered reporter (Sentry, toast, etc.)
 */
export function assert(condition: boolean, message: string): void {
  if (condition) return

  console.error(`[Assertion failed]: ${message}`)

  if (import.meta.env.DEV) {
    throw new Error(`[Assertion failed]: ${message}`)
  }

  reporter?.(message)
}
