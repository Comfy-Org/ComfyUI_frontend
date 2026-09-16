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

import type {
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type {
  BillingScope,
  BillingScopeContext,
  BillingScopeSource
} from './billingScope.js'
import { createBillingScopeTracker } from './billingScope.js'
import {
  matchesScopedRead,
  readValidatedBillingResponse,
  releaseOnAbort
} from './sharedRead.js'

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

interface InFlightRead {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<PaymentMethodsSnapshot>>
  /**
   * Set when the host invalidates while this request is in flight. The list it
   * returns was resolved before the change the host is reporting, so it may be
   * served to the callers already waiting on it but must not be published.
   */
  readonly pending: { invalidated: boolean }
}

export function createPaymentMethodsReader(
  options: PaymentMethodsReaderOptions
): PaymentMethodsReader {
  const { transport, scopeSource, now = Date.now } = options

  let snapshot: PaymentMethodsSnapshot | undefined
  let inFlight: InFlightRead | undefined
  const lifetime = { disposed: false }
  const scopeTracker = createBillingScopeTracker(scopeSource, () => {
    snapshot = undefined
    inFlight = undefined
  })

  async function requestPaymentMethods(
    scope: PaymentMethodsScope,
    timeoutMs: number | undefined
  ): Promise<BillingResult<PaymentMethodsSnapshot>> {
    const request: BillingRequest = {
      method: 'GET',
      route: PAYMENT_METHODS_ROUTE,
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    }
    const response = await readValidatedBillingResponse(
      transport,
      request,
      (body) => zListSavedPaymentMethodsResponse.safeParse(body)
    )
    if (response.status === 'error') return response

    return {
      status: 'ok',
      value: { scope, methods: response.value.data, readAt: now() }
    }
  }

  async function read(
    readOptions?: PaymentMethodsReadOptions
  ): Promise<BillingResult<PaymentMethodsSnapshot>> {
    if (lifetime.disposed) return { status: 'error', code: 'SUPERSEDED' }

    const context = scopeTracker.capture()
    if (context === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    const { scope } = context

    if (matchesScopedRead(inFlight, context)) {
      return releaseOnAbort(inFlight.promise, readOptions?.signal)
    }

    // The invalidation flag lives outside the attempt so the read body can
    // consult it without referencing the object that holds its own promise.
    const pending = { invalidated: false }
    // No caller signal reaches the shared request: it is bounded by its own
    // timeout, and one caller walking away must not fail the readers still
    // waiting on it. Each caller's signal releases only that caller, below.
    const promise = (async (): Promise<
      BillingResult<PaymentMethodsSnapshot>
    > => {
      const result = await requestPaymentMethods(scope, readOptions?.timeoutMs)
      if (result.status !== 'ok') {
        // The same fence the publish path carries: a denial that predates an
        // invalidation is no evidence about the list a later read published,
        // and clearing on it would drop a fresh list for a stale refusal.
        if (
          result.code === 'ACCESS_DENIED' &&
          !pending.invalidated &&
          scopeTracker.isCurrent(context)
        ) {
          snapshot = undefined
        }
        return result
      }

      // A list that arrives after the host moved to another workspace names
      // cards the current one cannot charge.
      if (lifetime.disposed || !scopeTracker.isCurrent(context)) {
        return { status: 'error', code: 'SUPERSEDED' }
      }

      if (!pending.invalidated) snapshot = result.value
      return result
    })()

    const attempt: InFlightRead = { context, promise, pending }
    inFlight = attempt
    const release = () => {
      if (inFlight === attempt) inFlight = undefined
    }
    promise.then(release, release)

    return releaseOnAbort(promise, readOptions?.signal)
  }

  return {
    read,
    getSnapshot: () => snapshot,
    invalidate: () => {
      snapshot = undefined
      // A request issued before this call resolved the list the host is
      // reporting as wrong, so it is fenced off from publishing and its slot
      // released: the read that follows an invalidation must issue its own
      // request rather than join the one that predates it.
      if (inFlight !== undefined) {
        inFlight.pending.invalidated = true
        inFlight = undefined
      }
    },
    dispose: () => {
      lifetime.disposed = true
      snapshot = undefined
      inFlight = undefined
      scopeTracker.dispose()
    }
  }
}
