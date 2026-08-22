export type AssertReporter = (failure: Error) => void

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
 *
 * Reporters forward `message` to external telemetry, so it must be a static
 * description of the invariant. Never interpolate user data (workflow names,
 * paths, prompts) into it.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (condition) return

  const formatted = `[Assertion failed]: ${message}`
  console.error(formatted)

  const failure = new Error(formatted)

  if (import.meta.env.DEV) {
    throw failure
  }

  try {
    reporter?.(failure)
  } catch (error) {
    console.error('[Assertion reporter failed]', error)
  }
}
