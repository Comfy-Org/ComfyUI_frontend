import type { CustomerActionHold } from '@comfyorg/account-core/billing'
import { isBlockedOnCustomerPhase } from '@comfyorg/account-core/billing'

import type {
  BillingAuthenticationState,
  BillingOperationPhase
} from '@/platform/workspace/api/workspaceApi'
import type { ToastId } from '@/types/toastId'

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

export type ProgressToastKind = 'processing' | 'action'

export interface ProgressToast {
  id: ToastId
  kind: ProgressToastKind
}

interface ProgressToastOperation {
  readonly actionUrl?: string | null
  readonly phase?: BillingOperationPhase | null
}

/**
 * A checkout parked on a card with no link to offer is a state the customer
 * leaves by subscribing again, not a payment in flight, so no surface may
 * describe it as one. A served link turns it back into a verification ask.
 */
export function isParkedCheckout(operation: ProgressToastOperation): boolean {
  return !operation.actionUrl && operation.phase === 'awaiting_payment_method'
}

export function progressToastKind(
  operation: ProgressToastOperation
): ProgressToastKind | undefined {
  if (operation.actionUrl) return 'action'
  if (isParkedCheckout(operation)) return undefined
  return 'processing'
}

interface LegacyActionOperation {
  readonly actionUrl: string | null
  readonly authenticationState: BillingAuthenticationState | null
  readonly isAuthenticating: boolean
}

/**
 * This store's surface offers the hosted link beside the embedded challenge,
 * and its challenge exists only while it holds the client secret. Rows that
 * intentionally differ from the SDK's `pendingOperationActionHold`:
 * - embedded with only an `action_url`: acts here, where the link is shown
 *   beside the challenge; the SDK's embedded surface never opens it.
 * - embedded checkout off with a retryable failure: waits here, where
 *   `authentication_state` is never read; the SDK's hosted surface shows the
 *   decline.
 */
export function legacyOperationActionHold(
  operation: LegacyActionOperation,
  holdsClientSecret: boolean
): CustomerActionHold {
  return {
    authenticationState: operation.authenticationState,
    offersHostedPage: operation.actionUrl !== null,
    ...(holdsClientSecret && {
      challenge: operation.isAuthenticating ? 'in_progress' : 'required'
    })
  }
}
