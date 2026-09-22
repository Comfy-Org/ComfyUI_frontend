/**
 * Projections from the SDK's operation state and top-up result onto the two
 * shapes the top-up dialog already reads: the poller's operation record and
 * the `CreateTopupResponse` the legacy call returned. The dialog is untouched;
 * these give it the same inputs from the other rail.
 */
import type {
  BillingDeclineReason,
  BillingOperationState,
  TopupFailure,
  TopupResult
} from '@comfyorg/account-core/billing'
import { unwrapServerCode } from '@comfyorg/account-core/billing'

import { t } from '@/i18n'
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
  switch (reason) {
    case 'insufficient_funds':
      return t('billingOperation.insufficientFundsDetail')
    case 'expired_card':
      return t('billingOperation.expiredCardDetail')
    case 'incorrect_cvc':
      return t('billingOperation.incorrectCvcDetail')
    case 'authentication_required':
    case 'authentication_failed':
      return t('billingOperation.authenticationFailedDetail')
    case 'processing_error':
      return t('billingOperation.processingErrorDetail')
    case 'card_declined':
    case 'generic':
      return t('billingOperation.paymentDeclinedDetail')
  }
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

function topupFailureError(failure: TopupFailure): WorkspaceApiError {
  const serverCode = 'serverCode' in failure ? failure.serverCode : undefined
  return new WorkspaceApiError(
    t('credits.topUp.unknownError'),
    'httpStatus' in failure ? failure.httpStatus : undefined,
    serverCode === undefined ? failure.code : unwrapServerCode(serverCode)
  )
}

/**
 * A settled result as the response the dialog handles today. `unsettled` has
 * no counterpart: the dialog reads an undefined response as "nothing to
 * report" and the operation stays visible through `projectTopupOperation`.
 * `topup_id` is not surfaced by the SDK and nothing reads it.
 */
export function projectTopupResult(
  result: TopupResult,
  amountCents: number
): CreateTopupResponse | undefined {
  switch (result.status) {
    case 'ok':
    case 'declined':
      return {
        billing_op_id: result.operation.id,
        topup_id: '',
        status: result.status === 'ok' ? 'completed' : 'failed',
        amount_cents: amountCents
      }
    case 'unsettled':
      return undefined
    case 'error':
      throw topupFailureError(result)
  }
}
