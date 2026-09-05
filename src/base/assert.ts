export const ASSERTION_FAILURE_PREFIX = '[Assertion failed]: '

type AssertReporter = (message: string) => void

let reporter: AssertReporter | null = null
let reporterForwardsToRum = false

/**
 * Register a reporter for assertion failures in non-DEV environments.
 * Called once at app startup by platform/ or higher layers to wire in
 * Sentry, toast notifications, etc.
 */
export function setAssertReporter(
  fn: AssertReporter | null,
  options: { forwardsToRum?: boolean } = {}
): void {
  reporter = fn
  reporterForwardsToRum = fn !== null && options.forwardsToRum === true
}

export function hasRumAssertReporter(): boolean {
  return reporterForwardsToRum
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

  const formatted = `${ASSERTION_FAILURE_PREFIX}${message}`
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
