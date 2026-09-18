import { isBlockedOnCustomerPhase } from '@comfyorg/account-core/billing'

import type {
  BillingAuthenticationState,
  BillingOperationPhase
} from '@/platform/workspace/api/workspaceApi'

// Re-exported so both rails read one definition: a second copy that drifted
// would reintroduce the give-up bug this predicate exists to prevent.
export { isBlockedOnCustomerPhase }

type OperationStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'reconciliation_needed'

interface CustomerAttentionOperation {
  readonly status: OperationStatus
  readonly actionUrl: string | null
  readonly authenticationState: BillingAuthenticationState | null
  readonly phase?: BillingOperationPhase | null
}

/** The poller's rule for which operation a dialog must show instead of its first step. */
export function needsCustomerAttention(
  operation: CustomerAttentionOperation
): boolean {
  return (
    operation.status === 'reconciliation_needed' ||
    (operation.status === 'pending' &&
      (operation.actionUrl !== null ||
        isBlockedOnCustomerPhase(operation.phase) ||
        operation.authenticationState === 'requires_action' ||
        operation.authenticationState === 'failed_retryable'))
  )
}
