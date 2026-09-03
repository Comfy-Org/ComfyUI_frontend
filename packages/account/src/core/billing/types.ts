import type {
  AccountAbortSignal,
  Namespace,
  ScheduleHandle,
  TransportRequest
} from '../index.js'

export type BillingStep =
  | 'select'
  | 'preview'
  | 'verifying'
  | 'canceled'
  | 'declined'
  | 'processing_error'
  | 'payment_received_hold'
  | 'success'
export type BillingOperationKind =
  | 'subscribe'
  | 'topup'
  | 'resubscribe'
  | 'cancel'
export type ReasonKey =
  | 'generic'
  | 'checkout_expired'
  | 'declined_generic'
  | 'declined_insufficient_funds'
  | 'declined_authentication_required'
export type BillingOperationStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'expired'
  | 'canceled'
  | 'payment_received_hold'

export interface SubscribeRequest {
  plan_slug: string
  return_url: string
  cancel_url: string
}
export interface TopupRequest {
  amount_cents: number
  idempotency_key: string
}
export interface ResubscribeRequest {
  idempotency_key?: string
}
export interface CancelRequest {
  idempotency_key?: string
}
export interface PaymentPortalRequest {
  return_url: string
}
export interface BillingOperationRef {
  billing_op_id: string
  action_url?: string
}
export interface SubscribeResponse {
  billing_op_id: string
  status: 'subscribed' | 'needs_payment_method' | 'pending_payment'
  payment_method_url?: string
  effective_at?: string
}
export interface TopupResponse extends BillingOperationRef {
  topup_id?: string
  amount_cents: number
  status: 'pending' | 'completed' | 'failed'
}
export interface ResubscribeResponse {
  status: 'active' | 'pending'
  billing_op_id?: string
  message?: string
}
export interface CancelResponse {
  billing_op_id: string
  cancel_at: string
}
export interface PaymentPortalResponse {
  url: string
}
export interface BillingStatusResponse {
  pending_billing_op_id?: string
  pending_billing_op_type?: 'subscription' | 'topup'
  action_url?: string
  subscription_tier?: string
  subscription_status?: string
  is_active?: boolean
}
export interface BillingOperationResponse {
  status: BillingOperationStatus
  started_at?: string
  action_url?: string
  reason_code?: string
  error_message?: string
  no_charge_confirmed?: boolean
}
export interface BillingOperationRecord {
  id: string
  kind: BillingOperationKind
  intent: string
  startedAt: number
  status: BillingOperationStatus
}
export interface BillingState {
  operationId?: string
  step: BillingStep
  reasonKey?: ReasonKey
  actionUrl?: string
  noChargeConfirmed: boolean
}
export interface BillingClock {
  now(): number
  schedule(fn: () => void, delayMs: number): ScheduleHandle
  cancel(handle: ScheduleHandle): void
}
export interface BillingOperationStore {
  namespace: Namespace
  getActiveId(): Promise<string | null>
  setActiveId(id: string): Promise<void>
  clearActiveId(): Promise<void>
}
export type OpenUrlMode = 'new_tab' | 'redirect' | 'preopened'
export interface BillingHostPorts {
  clock: BillingClock
  operationStore: BillingOperationStore
  openUrl(url: string, mode: OpenUrlMode): Promise<{ opened: boolean }>
}
export interface BillingTransport {
  transport(
    request: TransportRequest<unknown>
  ): Promise<{ status: number; body: unknown }>
}
export interface BillingApiClient {
  subscribe(
    input: SubscribeRequest,
    signal?: AccountAbortSignal
  ): Promise<SubscribeResponse>
  topup(
    input: TopupRequest,
    idempotencyKey: string,
    signal?: AccountAbortSignal
  ): Promise<TopupResponse>
  resubscribe(
    input: ResubscribeRequest,
    idempotencyKey: string,
    signal?: AccountAbortSignal
  ): Promise<ResubscribeResponse>
  cancel(
    input: CancelRequest,
    idempotencyKey: string,
    signal?: AccountAbortSignal
  ): Promise<CancelResponse>
  paymentPortal(
    input: PaymentPortalRequest,
    idempotencyKey: string,
    signal?: AccountAbortSignal
  ): Promise<PaymentPortalResponse>
  getOperation(
    id: string,
    signal?: AccountAbortSignal
  ): Promise<BillingOperationResponse>
  getStatus(signal?: AccountAbortSignal): Promise<BillingStatusResponse>
}
