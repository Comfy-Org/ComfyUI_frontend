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

  rumModule ??= import('@datadog/browser-rum')
  void rumModule
    .then(({ datadogRum }) => {
      datadogRum.addError(error, { source: 'invariant-assert' })
    })
    .catch(() => {})
}
