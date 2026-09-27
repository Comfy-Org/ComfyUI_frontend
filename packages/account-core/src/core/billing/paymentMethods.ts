/**
 * The saved payment methods read: the cards a workspace can charge, cached per
 * scope.
 *
 * Card details never reach this core beyond what the server already publishes —
 * brand, last four digits, and which one is the default — so nothing here has
 * to be redacted before a host renders it.
 */
import { zListSavedPaymentMethodsResponse } from '@comfyorg/ingest-types/zod'
import type { zSavedPaymentMethod } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { createScopedReader } from './scopedReader.js'

export const PAYMENT_METHODS_ROUTE = '/billing/payment-methods'

export type SavedPaymentMethod = z.infer<typeof zSavedPaymentMethod>

export type PaymentMethodsScope = BillingScope

export interface PaymentMethodsSnapshot {
  readonly scope: PaymentMethodsScope
  readonly methods: readonly SavedPaymentMethod[]
  /** ms since epoch at which this read settled. */
  readonly readAt: number
}

export interface PaymentMethodsReadOptions {
  readonly signal?: AbortSignal
  /** Bounds the request, when this caller is the one that issues it. */
  readonly timeoutMs?: number
}

export interface PaymentMethodsReader {
  /**
   * Always requests. Concurrent callers for one scope share a single request.
   */
  read: (
    options?: PaymentMethodsReadOptions
  ) => Promise<BillingResult<PaymentMethodsSnapshot>>
  /** The last list published for the current scope. */
  getSnapshot: () => PaymentMethodsSnapshot | undefined
  /**
   * Drops the published list without a scope change. A payment-portal round
   * trip adds or removes a card outside this reader, so the host that sent the
   * user there is the only thing that knows the list it holds is now wrong.
   */
  invalidate: () => void
  dispose: () => void
}

export interface PaymentMethodsReaderOptions {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

export function createPaymentMethodsReader(
  options: PaymentMethodsReaderOptions
): PaymentMethodsReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    readonly SavedPaymentMethod[],
    PaymentMethodsSnapshot,
    PaymentMethodsReadOptions
  >({
    transport,
    scopeSource,
    route: PAYMENT_METHODS_ROUTE,
    parse: (body) => zListSavedPaymentMethodsResponse.safeParse(body),
    timeoutMs: (readOptions) => readOptions?.timeoutMs,
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { scope, methods: data, readAt: now() }
    }),
    // A list resolved before the change the host is reporting may be served to
    // the callers already waiting on it, but must not be published.
    publish: (value, fenced) => (fenced ? undefined : value)
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    invalidate: () => {
      reader.setSnapshot(undefined)
      reader.fenceInFlight({ detach: true })
    },
    dispose: reader.dispose
  }
}
