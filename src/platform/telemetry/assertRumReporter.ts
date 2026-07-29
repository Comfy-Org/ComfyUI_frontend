import type * as DatadogRumModule from '@datadog/browser-rum'

const MAX_REPORTS_PER_SESSION = 20

const reportedMessages = new Set<string>()

let rumModule: Promise<typeof DatadogRumModule> | undefined

/**
 * Send an assertion failure to Datadog RUM Error Tracking (cloud builds only).
 *
 * Invariants can fire from render loops, so reports are deduplicated by exact
 * message and capped per session. The RUM SDK is imported lazily because it is
 * only ever loaded on cloud, where `bootstrap.ts` has already resolved it.
 */
export function reportAssertFailureToRum(message: string): void {
  if (reportedMessages.has(message)) return
  if (reportedMessages.size >= MAX_REPORTS_PER_SESSION) return
  reportedMessages.add(message)

  // Built here, before awaiting the SDK, so the stack holds the assert call site.
  const error = new Error(message)

  const pending = (rumModule ??= import('@datadog/browser-rum'))
  void pending
    .then(({ datadogRum }) => {
      datadogRum.addError(error, { source: 'invariant-assert' })
    })
    .catch(() => {
      // Release the message and the cached import so a transient failure
      // doesn't silently disable reporting for the rest of the session.
      if (rumModule === pending) rumModule = undefined
      reportedMessages.delete(message)
    })
}
