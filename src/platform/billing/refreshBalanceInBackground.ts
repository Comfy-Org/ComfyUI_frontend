import { reportError } from '@comfyorg/telemetry/reportError'

/** Whether the current run of failures has been reported; a success clears it. */
let failureReported = false

/**
 * Starts a balance read that nothing awaits. The billing context keeps the
 * failure for the balance UI to show; this reports it as a warning instead of
 * letting it escape as an unhandled rejection, once per run of failures so a
 * user reopening the account menu during an outage does not repeat it.
 */
export function refreshBalanceInBackground(
  fetchBalance: () => Promise<unknown>
): void {
  void fetchBalance().then(
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
