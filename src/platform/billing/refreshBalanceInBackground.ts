import { reportError } from '@comfyorg/telemetry/reportError'

/**
 * Starts a balance read that nothing awaits. The billing context keeps the
 * failure for the balance UI to show; this reports it once instead of letting
 * it escape as an unhandled rejection.
 */
export function refreshBalanceInBackground(
  fetchBalance: () => Promise<unknown>
): void {
  void fetchBalance().catch((error: unknown) => {
    reportError(error, {
      surface: 'billing',
      errorType: 'error_refreshing_balance',
      level: 'warning'
    })
  })
}
