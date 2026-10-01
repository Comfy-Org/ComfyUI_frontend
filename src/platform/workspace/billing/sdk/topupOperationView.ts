/**
 * Projections from the SDK's operation state and top-up result onto the two
 * shapes the top-up dialog already reads: the poller's operation record and
 * the `CreateTopupResponse` the legacy call returned, plus the terminal the
 * SDK observed where those shapes cannot hold it.
 */
import type {
  BillingDeclineReason,
  BillingOperationState,
  TopupFailure,
  TopupResult
} from '@comfyorg/account-core/billing'
import {
  declineDetailKey,
  unwrapServerCode
} from '@comfyorg/account-core/billing'

import { t } from '@/i18n'
import type {
  BillingFailure,
  BillingOperationTerminal
} from '@/platform/telemetry/types'
import type {
  BillingAuthenticationState,
  BillingOperationPhase,
  CreateTopupResponse
} from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

export interface TopupOperationView {
  readonly opId: string
  readonly status: 'pending' | 'reconciliation_needed'
  readonly actionUrl: string | null
  readonly phase: BillingOperationPhase | null
  readonly authenticationState: BillingAuthenticationState | null
  readonly isAuthenticating: boolean
  readonly canRetryAuthentication: boolean
  readonly errorMessage: string | null
}

export function declineDetail(reason: BillingDeclineReason): string {
  return t(`billingOperation.${declineDetailKey(reason)}`)
}

export function projectTopupOperation(
  state: BillingOperationState
): TopupOperationView | undefined {
  if (state.kind !== 'topup') return undefined
  if (state.phase === 'reconciliation_needed') {
    return {
      opId: state.id,
      status: 'reconciliation_needed',
      actionUrl: null,
      phase: null,
      authenticationState: 'reconciliation_needed',
      isAuthenticating: false,
      canRetryAuthentication: false,
      errorMessage: null
    }
  }
  if (state.phase !== 'pending') return undefined

  const authenticationState = state.authenticationState ?? null
  return {
    opId: state.id,
    status: 'pending',
    actionUrl: state.actionUrl ?? null,
    phase: state.serverPhase ?? null,
    authenticationState,
    isAuthenticating: state.challenge?.status === 'in_progress',
    canRetryAuthentication: state.challenge?.status === 'required',
    errorMessage:
      authenticationState === 'failed_retryable'
        ? declineDetail(state.declineReason ?? 'authentication_failed')
        : null
  }
}

/**
 * A purchase the SDK settled without crediting, as the response the dialog
 * handles, carrying the terminal its status cannot: the decline reason, or
 * that this tab stopped watching, or that support must reconcile it.
 */
export class UncreditedTopupResponse implements CreateTopupResponse {
  readonly topup_id = ''

  constructor(
    readonly billing_op_id: string,
    readonly status: 'failed' | 'pending',
    readonly amount_cents: number,
    readonly terminal: BillingOperationTerminal
  ) {}
}

/**
 * Most SDK refusals carry no HTTP status, which a status-less API error
 * would otherwise report as a network failure, so each names its category.
 */
function topupFailureError(failure: TopupFailure): WorkspaceApiError {
  const serverCode = 'serverCode' in failure ? failure.serverCode : undefined
  return new WorkspaceApiError(
    t('credits.topUp.unknownError'),
    'httpStatus' in failure ? failure.httpStatus : undefined,
    serverCode === undefined ? failure.code : unwrapServerCode(serverCode),
    topupFailureCategory(failure)
  )
}

function topupFailureCategory(
  failure: TopupFailure
): BillingFailure['failure_category'] {
  switch (failure.code) {
    case 'REQUEST_FAILED':
      return failure.httpStatus === undefined ? 'network' : 'api_rejected'
    case 'SUPERSEDED':
      return 'stale_operation'
    case 'INVALID_AMOUNT':
      return 'validation'
    default:
      return 'api_rejected'
  }
}

/**
 * A settled result as the response the dialog handles today. `unsettled` is
 * the pending response: the server may still settle it, and the operation
 * stays visible through `projectTopupOperation`. `topup_id` is not surfaced
 * by the SDK and nothing reads it.
 */
export function projectTopupResult(
  result: TopupResult,
  amountCents: number
): CreateTopupResponse {
  switch (result.status) {
    case 'ok':
      return {
        billing_op_id: result.operation.id,
        topup_id: '',
        status: 'completed',
        amount_cents: amountCents
      }
    case 'declined':
      return new UncreditedTopupResponse(
        result.operation.id,
        'failed',
        amountCents,
        {
          stage: 'failed',
          outcome: 'failure',
          failure_category: 'provider_decline',
          decline_reason: result.operation.declineReason
        }
      )
    case 'unsettled':
      return new UncreditedTopupResponse(
        result.operation.id,
        'pending',
        amountCents,
        result.operation.phase === 'timed_out'
          ? {
              stage: 'timeout',
              outcome: 'failure',
              failure_category: 'poll_timeout'
            }
          : {
              stage: 'failed',
              outcome: 'failure',
              failure_category: 'reconciliation_needed'
            }
      )
    case 'error':
      throw topupFailureError(result)
  }
}
