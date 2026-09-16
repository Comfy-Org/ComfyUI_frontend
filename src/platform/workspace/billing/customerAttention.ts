import type {
  BillingAuthenticationState,
  BillingOperationPhase
} from '@/platform/workspace/api/workspaceApi'

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

/**
 * The phases the contract defines as blocked on the customer. Neither advances
 * on its own, so an operation reporting one waits on them even before it has a
 * link to offer.
 */
export function isBlockedOnCustomerPhase(
  phase: BillingOperationPhase | null | undefined
): boolean {
  return (
    phase === 'awaiting_payment_method' || phase === 'awaiting_invoice_payment'
  )
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
