import { reportError } from './reportError'

const MAX_REPORTS_PER_SESSION = 20
const REPORTABLE_OCCURRENCE_COUNTS = new Set([1, 10, 100, 1000])

const occurrenceCounts = new Map<string, number>()

/**
 * Send an assertion failure to diagnostic error reporting.
 *
 * Invariants can fire from render loops, so only coarse recurrence thresholds
 * are reported and the number of distinct messages is capped per session.
 */
export function reportAssertFailure(
  message: string,
  context?: Record<string, unknown>
): void {
  const previousCount = occurrenceCounts.get(message)
  if (
    previousCount === undefined &&
    occurrenceCounts.size >= MAX_REPORTS_PER_SESSION
  ) {
    return
  }

  const occurrenceCount = (previousCount ?? 0) + 1
  occurrenceCounts.set(message, occurrenceCount)
  if (!REPORTABLE_OCCURRENCE_COUNTS.has(occurrenceCount)) return

  reportError(new Error(message), {
    errorType: 'invariant_assert',
    context: { ...context, occurrenceCount }
  })
}
