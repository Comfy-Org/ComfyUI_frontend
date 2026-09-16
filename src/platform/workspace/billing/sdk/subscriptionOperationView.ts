/**
 * Projections from the SDK's subscription results onto what the workspace
 * billing adapter already does with the legacy calls: succeed, throw a
 * `WorkspaceApiError`, or hand the action back so the legacy call runs.
 *
 * A 404 is the third case. The backend gate on these routes is independent of
 * the client flag, so a rail that is on before the routes are deployed must
 * leave the customer on the path that still works.
 */
import type {
  PaymentPortalResult,
  SubscriptionCommandFailure,
  SubscriptionCommandResult
} from '@comfyorg/account/billing'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

export type SubscriptionRailOutcome<T = void> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'error'; readonly error: Error }
  /** The route is not deployed here; the caller runs its legacy path. */
  | { readonly status: 'unavailable' }

/**
 * The three subscription actions the host routes through the SDK. Cancel and
 * resubscribe report only whether they settled; the portal hands back the URL
 * the host opens.
 */
export interface SubscriptionRail {
  cancelSubscription: (
    failureMessage: string
  ) => Promise<SubscriptionRailOutcome>
  resubscribe: (failureMessage: string) => Promise<SubscriptionRailOutcome>
  openPaymentPortal: (
    returnUrl: string,
    failureMessage: string
  ) => Promise<SubscriptionRailOutcome<string>>
}

const UNAVAILABLE = { status: 'unavailable' } as const

const SETTLED: SubscriptionRailOutcome = { status: 'ok', value: undefined }

/**
 * The failure as the adapter's own error. The SDK's codes never carry server
 * text, so the message is the host's; `serverCode` lands where the adapter
 * already keeps `WorkspaceApiError.code`.
 */
function projectFailure(
  failure: SubscriptionCommandFailure,
  failureMessage: string
): SubscriptionRailOutcome<never> {
  const httpStatus = 'httpStatus' in failure ? failure.httpStatus : undefined
  if (httpStatus === 404) return UNAVAILABLE

  const serverCode = 'serverCode' in failure ? failure.serverCode : undefined
  return {
    status: 'error',
    error: new WorkspaceApiError(
      failureMessage,
      httpStatus,
      serverCode ?? failure.code
    )
  }
}

/**
 * A command that settled anywhere but `succeeded` failed for the customer,
 * exactly as a poller operation that ends in any other status does.
 */
export function projectSubscriptionResult(
  result: SubscriptionCommandResult,
  failureMessage: string
): SubscriptionRailOutcome {
  if (result.status === 'error') return projectFailure(result, failureMessage)
  return result.value.phase === 'succeeded'
    ? SETTLED
    : { status: 'error', error: new Error(failureMessage) }
}

export function projectPaymentPortalResult(
  result: PaymentPortalResult,
  failureMessage: string
): SubscriptionRailOutcome<string> {
  if (result.status === 'error') return projectFailure(result, failureMessage)
  return { status: 'ok', value: result.value.url }
}
