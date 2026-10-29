import { reportError } from '@comfyorg/telemetry/reportError'

let failureReported = false

/** Reads the balance for a caller that does not await it; reports a run of failures once and never rejects. */
export function refreshBalanceInBackground(
  fetchBalance: () => Promise<unknown>
): Promise<void> {
  return fetchBalance().then(
    () => {
      failureReported = false
    },
    (error: unknown) => {
      if (failureReported) return
      failureReported = true
      reportError(error, {
        surface: 'billing',
        errorType: 'error_refreshing_balance',
        level: 'warning'
      })
    }
  )
}
