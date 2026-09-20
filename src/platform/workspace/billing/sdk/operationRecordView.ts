/**
 * An SDK operation state as the record the legacy poller handed out. The
 * surfaces that look an operation up by id, or ask which one is waiting on the
 * customer, read these fields off `billingOperationStore` today; projecting
 * them here is what lets those call sites move to the rail without their
 * templates or their conditions changing.
 */
import type { BillingOperationState } from '@comfyorg/account-core/billing'

import type {
  BillingAuthenticationState,
  BillingOperationPhase
} from '@/platform/workspace/api/workspaceApi'

import { declineDetail } from './topupOperationView'

type OperationKind = BillingOperationState['kind']

type OperationStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'reconciliation_needed'

export interface BillingOperationRecordView {
  readonly opId: string
  readonly kind: OperationKind
  readonly workspaceId: string
  readonly status: OperationStatus
  readonly actionUrl: string | null
  readonly phase: BillingOperationPhase | null
  readonly authenticationState: BillingAuthenticationState | null
  readonly isAuthenticating: boolean
  readonly canRetryAuthentication: boolean
  /** The declined-attempt line a surface shows under its own summary. */
  readonly errorMessage: string | null
}

/**
 * `superseded` has no counterpart in the legacy record: the scope moved on
 * under the operation, so there is nothing for this workspace's surfaces to
 * read — the same outcome `readOnRail` gives a superseded read.
 */
export function projectOperationRecord(
  state: BillingOperationState
): BillingOperationRecordView | undefined {
  if (state.phase === 'superseded') return undefined

  const identity = {
    opId: state.id,
    kind: state.kind,
    workspaceId: state.scope.workspaceId
  } as const

  if (state.phase !== 'pending') {
    return {
      ...identity,
      status: state.phase === 'timed_out' ? 'timeout' : state.phase,
      actionUrl: null,
      phase: null,
      authenticationState:
        state.phase === 'reconciliation_needed'
          ? 'reconciliation_needed'
          : null,
      isAuthenticating: false,
      canRetryAuthentication: false,
      errorMessage: null
    }
  }

  return {
    ...identity,
    status: 'pending',
    actionUrl: state.actionUrl ?? null,
    phase: state.serverPhase ?? null,
    authenticationState: state.authenticationState ?? null,
    isAuthenticating: state.challenge?.status === 'in_progress',
    canRetryAuthentication: state.challenge?.status === 'required',
    errorMessage:
      state.authenticationState === 'failed_retryable'
        ? declineDetail(state.declineReason ?? 'authentication_failed')
        : null
  }
}
