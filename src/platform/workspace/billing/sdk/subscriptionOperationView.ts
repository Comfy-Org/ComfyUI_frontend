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
  PreviewSubscribeInput,
  PreviewSubscribeResult,
  SubscribeInput,
  SubscriptionCommandFailure,
  SubscriptionCommandOutcome,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'

import { t } from '@/i18n'
import type {
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import { declineDetail } from './topupOperationView'

/**
 * A subscribe response as the checkout reads it. `requiredPayment` is set only
 * by the SDK rail, where `status` is always the settled `subscribed`: it says
 * whether the server had to take a payment from the customer to get there.
 * The legacy path leaves it unset — there a `subscribed` response is a plan
 * that was already active, and the poller it never started is what drew the
 * same line.
 */
export interface SettledSubscribeResponse extends SubscribeResponse {
  readonly requiredPayment?: boolean
}

import type { BillingOperationRecordView } from './operationRecordView'

export type SubscriptionRailOutcome<T = void> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'error'; readonly error: Error }
  /** The route is not deployed here; the caller runs its legacy path. */
  | { readonly status: 'unavailable' }

/**
 * The subscription actions the host routes through the SDK. Cancel and
 * resubscribe report only whether they settled; the portal hands back the URL
 * the host opens; subscribe and its quote hand back the bodies the checkout
 * already reads.
 */
export interface SubscriptionRail {
  /**
   * The hosted step a subscribe on this rail is parked on, or null. The rail
   * opens it once itself, so this is what the checkout puts behind a button
   * when the browser blocked that open.
   */
  readonly subscriptionActionUrl: string | null
  /**
   * The subscribe waiting on the customer, as the poller's record. The checkout
   * drives its parked-recovery prompt, its authentication state and its busy
   * state off this, so on this rail it has to come from the lifecycle.
   */
  readonly subscriptionActionOperation: BillingOperationRecordView | undefined
  /** One operation by id, unscoped: the caller compares the workspace itself. */
  getOperation: (opId: string) => BillingOperationRecordView | undefined
  subscribe: (
    input: SubscribeInput
  ) => Promise<SubscriptionRailOutcome<SettledSubscribeResponse>>
  previewSubscribe: (
    input: PreviewSubscribeInput
  ) => Promise<SubscriptionRailOutcome<PreviewSubscribeResponse>>
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
 * A settle that ended anywhere but `succeeded` as a sentence for the customer:
 * a declined card carries the reason the top-up view already localizes, and
 * every other terminal phase is the generic subscription failure. The phase
 * itself lands on `code`, where the adapter keeps machine identifiers.
 */
function projectUnsuccessfulSettle(
  outcome: SubscriptionCommandOutcome
): SubscriptionRailOutcome<never> {
  const { operation, phase } = outcome
  return {
    status: 'error',
    error: new WorkspaceApiError(
      operation?.phase === 'failed'
        ? declineDetail(operation.declineReason)
        : t('billingOperation.subscriptionFailedDetail'),
      undefined,
      phase
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
    : projectUnsuccessfulSettle(result.value)
}

/**
 * A settled subscribe as the body `handleSubscribeResponse` already handles.
 * The SDK waits for the operation, so by the time this projects there is
 * nothing left to poll: the status is always the settled `subscribed`, never
 * the response's `needs_payment_method` or `pending_payment`, both of which
 * the lifecycle drove to a conclusion first. `issuedStatus` is what the
 * server answered before that, so `requiredPayment` keeps the line the legacy
 * poller drew: it watched — and so counted and announced — exactly the
 * subscribes the server could not activate on the spot. An adopted operation
 * carries no issued status and is one the server was still settling, which is
 * the same side of that line.
 *
 * An outcome carries no operation only when the server answered that the
 * requested state already held, which subscribe never reaches: the route
 * documents no already-held code.
 */
export function projectSubscribeResult(
  result: SubscriptionCommandResult
): SubscriptionRailOutcome<SettledSubscribeResponse> {
  if (result.status === 'error') return projectFailure(result)
  const { phase, operation, issuedStatus } = result.value
  if (phase !== 'succeeded' || operation === undefined) {
    return projectUnsuccessfulSettle(result.value)
  }
  return {
    status: 'ok',
    value: {
      billing_op_id: operation.id,
      status: 'subscribed',
      requiredPayment: issuedStatus !== 'subscribed'
    }
  }
}

export function projectPreviewSubscribeResult(
  result: PreviewSubscribeResult
): SubscriptionRailOutcome<PreviewSubscribeResponse> {
  return result.status === 'error'
    ? projectFailure(result)
    : { status: 'ok', value: result.value }
}

export function projectPaymentPortalResult(
  result: PaymentPortalResult
): SubscriptionRailOutcome<string> {
  if (result.status === 'error') return projectFailure(result)
  return { status: 'ok', value: result.value.url }
}
