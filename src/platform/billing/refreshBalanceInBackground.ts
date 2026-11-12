import { reportError } from '@comfyorg/telemetry/reportError'

const REPORT_INTERVAL_MS = 5 * 60_000
let lastReportedAt = Number.NEGATIVE_INFINITY

/** Reads the balance for a caller that does not await it; reports a failure at most every 5 minutes and never rejects. */
export function refreshBalanceInBackground(
  fetchBalance: () => Promise<unknown>
): Promise<void> {
  return fetchBalance().then(
    () => undefined,
    (error: unknown) => {
      const now = Date.now()
      if (now - lastReportedAt < REPORT_INTERVAL_MS) return
      lastReportedAt = now
      reportError(error, {
        surface: 'billing',
        errorType: 'error_refreshing_balance',
        level: 'warning'
      })
    }
  )
}
