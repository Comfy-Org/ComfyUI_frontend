import type {
  BillingOperationKind,
  BillingState,
  Loadable,
  BillingBalanceResponse
} from '../index.js'

export interface AccountLayerOperationRecord {
  id: string
  kind: BillingOperationKind
  started_at: number
  return_url: string | null
}

export interface AccountLayerPocSeam {
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
