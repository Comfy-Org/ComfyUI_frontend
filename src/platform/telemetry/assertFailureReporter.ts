import { reportError } from './reportError'

const MAX_REPORTS_PER_SESSION = 20

const reportedMessages = new Set<string>()

/**
 * Send an assertion failure to diagnostic error reporting.
 *
 * Invariants can fire from render loops, so reports are deduplicated by exact
 * message and capped per session.
 */
export function reportAssertFailure(
  failure: Error,
  context?: Record<string, unknown>
): void {
  const { message } = failure
  if (reportedMessages.has(message)) return
  if (reportedMessages.size >= MAX_REPORTS_PER_SESSION) return
  reportedMessages.add(message)

  reportError(failure, {
    errorType: 'assertion_failure',
    level: 'warning',
    context
  })
}
