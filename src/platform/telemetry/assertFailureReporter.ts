import { reportError } from './reportError'

const MAX_REPORTS_PER_SESSION = 20

const reportedMessages = new Set<string>()

/**
 * Send an assertion failure to diagnostic error reporting.
 *
 * Invariants can fire from render loops, so reports are deduplicated by exact
 * message and capped per session.
 */
export function reportAssertFailure(message: string): void {
  if (reportedMessages.has(message)) return
  if (reportedMessages.size >= MAX_REPORTS_PER_SESSION) return
  reportedMessages.add(message)

  reportError(new Error(message), {
    errorType: 'invariant_assert'
  })
}
