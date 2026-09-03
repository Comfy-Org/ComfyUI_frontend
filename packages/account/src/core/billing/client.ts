import { AccountError, MalformedResponseError } from '../index.js'
import type { AccountAbortSignal, TransportRequest } from '../index.js'
import type {
  BillingApiClient,
  BillingOperationResponse,
  BillingTransport,
  CancelRequest,
  CancelResponse,
  PaymentPortalRequest,
  PaymentPortalResponse,
  ResubscribeRequest,
  ResubscribeResponse,
  SubscribeRequest,
  SubscribeResponse,
  TopupRequest,
  TopupResponse
} from './types.js'

export const billingPaths = {
  subscribe: '/api/billing/subscribe',
  topup: '/api/billing/topup',
  resubscribe: '/api/billing/subscription/resubscribe',
  cancel: '/api/billing/subscription/cancel',
  paymentPortal: '/api/billing/payment-portal',
  operation: (id: string) => `/api/billing/ops/${encodeURIComponent(id)}`
} as const

const alive: AccountAbortSignal = { aborted: false }
function decode<T>(body: unknown): T {
  if (!body || typeof body !== 'object') throw new MalformedResponseError()
  return body as T
}
async function request<T>(
  transport: BillingTransport,
  path: string,
  method: 'GET' | 'POST',
  key: string,
  body?: unknown,
  signal: AccountAbortSignal = alive
) {
  const value: TransportRequest<unknown> = {
    method,
    path,
    headers: { 'Idempotency-Key': key },
    ...(body === undefined ? {} : { body }),
    signal
  }
  const response = await transport.transport(value)
  if (response.status < 200 || response.status >= 300)
    throw new AccountError('Billing request failed', response.status)
  return decode<T>(response.body)
}

export function createBillingApiClient(
  transport: BillingTransport
): BillingApiClient {
  return {
    subscribe: (
      input: SubscribeRequest,
      key: string,
      signal?: AccountAbortSignal
    ) =>
      request<SubscribeResponse>(
        transport,
        billingPaths.subscribe,
        'POST',
        key,
        input,
        signal
      ),
    topup: (input: TopupRequest, key: string, signal?: AccountAbortSignal) =>
      request<TopupResponse>(
        transport,
        billingPaths.topup,
        'POST',
        key,
        input,
        signal
      ),
    resubscribe: (
      input: ResubscribeRequest,
      key: string,
      signal?: AccountAbortSignal
    ) =>
      request<ResubscribeResponse>(
        transport,
        billingPaths.resubscribe,
        'POST',
        key,
        input,
        signal
      ),
    cancel: (input: CancelRequest, key: string, signal?: AccountAbortSignal) =>
      request<CancelResponse>(
        transport,
        billingPaths.cancel,
        'POST',
        key,
        input,
        signal
      ),
    paymentPortal: (
      input: PaymentPortalRequest,
      key: string,
      signal?: AccountAbortSignal
    ) =>
      request<PaymentPortalResponse>(
        transport,
        billingPaths.paymentPortal,
        'POST',
        key,
        input,
        signal
      ),
    getOperation: (id: string, signal?: AccountAbortSignal) =>
      request<BillingOperationResponse>(
        transport,
        billingPaths.operation(id),
        'GET',
        '',
        undefined,
        signal
      )
  }
}
