import type { BillingAuthenticationState } from '@/platform/workspace/api/workspaceApi'

/**
 * Whether the checkout confirm action must stay locked for a verification
 * still in flight. A failed challenge is over — the intent has fallen back to
 * requires_payment_method, so a fresh attempt is the recovery and the action
 * stays live. requires_action and a reconciliation hold genuinely are in
 * flight and lock it.
 */
export function isVerificationRecoveryActive(options: {
  embeddedCheckoutEnabled: boolean
  authenticationState: BillingAuthenticationState | null
  reconciliationOperationId: string | null
}): boolean {
  return (
    options.embeddedCheckoutEnabled &&
    (options.authenticationState === 'requires_action' ||
      Boolean(options.reconciliationOperationId))
  )
}
