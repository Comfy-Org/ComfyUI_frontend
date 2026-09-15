import type { useBillingOperationStore } from '../stores/billingOperationStore'

export type BillingOperation = Awaited<
  ReturnType<ReturnType<typeof useBillingOperationStore>['startOperation']>
>

export function billingOperation(
  overrides: Partial<BillingOperation> = {}
): BillingOperation {
  return {
    opId: 'op-test',
    type: 'subscription',
    status: 'pending',
    errorMessage: null,
    startedAt: 0,
    operationStartedAt: 0,
    actionUrl: null,
    authenticationState: null,
    isAuthenticating: false,
    canRetryAuthentication: false,
    authenticationRequiredSeen: false,
    workspaceId: 'workspace-1',
    autoHandleRequiresAction: false,
    phase: null,
    dismissed: false,
    ...overrides
  }
}
