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
} from '@comfyorg/account-core/billing'

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
  cancelSubscription: () => Promise<SubscriptionRailOutcome>
  resubscribe: () => Promise<SubscriptionRailOutcome>
  openPaymentPortal: (
    returnUrl: string
  ) => Promise<SubscriptionRailOutcome<string>>
}

const UNAVAILABLE = { status: 'unavailable' } as const

const SETTLED: SubscriptionRailOutcome = { status: 'ok', value: undefined }

/**
 * What the host renders under its own localized summary, so the two lines do
 * not repeat each other. The SDK's failures carry no server text, so this is
 * the code the command settled on plus the status the server answered with —
 * `serverCode` stays out of it, being unbounded in shape and a value to match
 * rather than to show.
 */
function describeFailure(code: string, httpStatus: number | undefined): string {
  return httpStatus === undefined ? code : `${code} (${httpStatus})`
}

/**
 * The failure as the adapter's own error. `serverCode` lands where the
 * adapter already keeps `WorkspaceApiError.code`.
 */
function projectFailure(
  failure: SubscriptionCommandFailure
): SubscriptionRailOutcome<never> {
  const httpStatus = 'httpStatus' in failure ? failure.httpStatus : undefined
  if (httpStatus === 404) return UNAVAILABLE

  const serverCode = 'serverCode' in failure ? failure.serverCode : undefined
  return {
    status: 'error',
    error: new WorkspaceApiError(
      describeFailure(failure.code, httpStatus),
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
  result: SubscriptionCommandResult
): SubscriptionRailOutcome {
  if (result.status === 'error') return projectFailure(result)
  return result.value.phase === 'succeeded'
    ? SETTLED
    : { status: 'error', error: new Error(`phase: ${result.value.phase}`) }
}

export function projectPaymentPortalResult(
  result: PaymentPortalResult
): SubscriptionRailOutcome<string> {
  if (result.status === 'error') return projectFailure(result)
  return { status: 'ok', value: result.value.url }
}
