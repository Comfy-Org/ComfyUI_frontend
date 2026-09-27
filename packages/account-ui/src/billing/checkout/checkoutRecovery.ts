import type { BillingAuthenticationState } from '@comfyorg/account-core/billing'

export interface CheckoutRecoveryState {
  readonly actionUrl: string | null
  readonly authenticationState: BillingAuthenticationState | null
  readonly reconciliationOperationId: string | null
  readonly embeddedCheckoutEnabled: boolean
}

/** A 3DS link is on offer unless the last attempt at it already failed. */
export function isVerificationOffered({
  actionUrl,
  authenticationState
}: CheckoutRecoveryState): boolean {
  return Boolean(actionUrl) && authenticationState !== 'failed_retryable'
}

/**
 * While an earlier payment still needs the customer (a verification to
 * finish, a failed one to retry, or a charge awaiting reconciliation), the
 * pay action stays disabled so a second charge cannot start beside it.
 */
export function isVerificationRecoveryActive(
  state: CheckoutRecoveryState
): boolean {
  return (
    isVerificationOffered(state) ||
    (state.embeddedCheckoutEnabled &&
      (state.authenticationState === 'requires_action' ||
        state.authenticationState === 'failed_retryable' ||
        Boolean(state.reconciliationOperationId)))
  )
}

/**
 * `parked`: complete the checkout an earlier subscribe left waiting;
 * `form`: the card form; `pay`: pay without it (saved method, $0 or an
 * unidentified quote); `subscribe`: hand off to a hosted continuation.
 */
export type CheckoutPayAction = 'parked' | 'form' | 'pay' | 'subscribe'
