import { reportError } from '@comfyorg/telemetry/reportError'

/** Whether the current run of failures has been reported; a success clears it. */
let failureReported = false

/** Starts a balance read that nothing awaits; reports a run of failures once. */
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
