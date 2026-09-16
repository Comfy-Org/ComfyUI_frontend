import type { BillingAuthenticationState } from '@/platform/workspace/api/workspaceApi'

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
}

/** The poller's rule for which operation a dialog must show instead of its first step. */
export function needsCustomerAttention(
  operation: CustomerAttentionOperation
): boolean {
  return (
    operation.status === 'reconciliation_needed' ||
    (operation.status === 'pending' &&
      (operation.actionUrl !== null ||
        operation.authenticationState === 'requires_action' ||
        operation.authenticationState === 'failed_retryable'))
  )
}
