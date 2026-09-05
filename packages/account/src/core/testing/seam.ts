import type {
  BillingOperationKind,
  BillingState,
  Loadable,
  BillingBalanceResponse
} from '../index.js'

export type AccountLayerSessionPhase =
  | 'idle'
  | 'restoring'
  | 'exchanging'
  | 'authenticated'
  | 'refreshing'
  | 'signed-out'
  | 'error'

export class AccountLayerReadinessTimeoutError extends Error {
  readonly code = 'ACCOUNT_LAYER_READINESS_TIMEOUT'

  constructor(timeoutMs: number) {
    super(`Account session was not authenticated within ${timeoutMs}ms`)
    this.name = 'AccountLayerReadinessTimeoutError'
  }
}

export interface AccountLayerOperationRecord {
  id: string
  kind: BillingOperationKind
  started_at: number
  return_url: string | null
}

export interface AccountLayerPocSeam {
  getSessionPhase(): AccountLayerSessionPhase
  whenAuthenticated(timeoutMs?: number): Promise<void>
  subscribe(planId?: string): Promise<void>
  topUp(amount?: number): Promise<void>
  cancelSubscription(): Promise<void>
  resubscribe(): Promise<void>
  openPaymentPortal(): Promise<void>
  projectPaymentState(state: BillingState): Promise<void>
  getPaymentState(): BillingState
  getOperationStore(): AccountLayerOperationRecord | null
  refreshCredits(): Promise<void>
  getCredits(): Loadable<BillingBalanceResponse>
  signOut(): Promise<void>
  lastOpenedUrl: string | null
}
