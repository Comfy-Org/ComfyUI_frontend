/**
 * The plans read: the catalog a workspace may subscribe to, cached per scope.
 *
 * Availability, seat costs, and the credit-stop ladder are all resolved by the
 * server for the actor that asked, so the response is cached under the scope it
 * was resolved for and no plan is filtered, ranked, or priced here.
 */
import { zGetBillingPlansResponse } from '@comfyorg/ingest-types/zod'
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

export const PLANS_ROUTE = '/billing/plans'

export type BillingPlansData = z.infer<typeof zGetBillingPlansResponse>

export type PlansScope = BillingScope

export interface PlansSnapshot {
  readonly scope: PlansScope
  readonly data: BillingPlansData
  /** ms since epoch at which this read settled. */
  readonly readAt: number
}

export interface PlansReadOptions {
  readonly signal?: AbortSignal
  /** Bounds the request, when this caller is the one that issues it. */
  readonly timeoutMs?: number
}

export interface PlansReader {
  /**
   * Always requests. The catalog changes rarely, but nothing in the response
   * declares how long it stays valid, so the host decides when to re-read
   * rather than the core inventing a freshness window nobody published.
   * Concurrent callers for one scope still share a single request.
   */
  read: (options?: PlansReadOptions) => Promise<BillingResult<PlansSnapshot>>
  /** The last catalog published for the current scope. */
  getSnapshot: () => PlansSnapshot | undefined
  dispose: () => void
}

export interface PlansReaderOptions {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

interface InFlightRead {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<PlansSnapshot>>
}

export function createPlansReader(options: PlansReaderOptions): PlansReader {
  const { transport, scopeSource, now = Date.now } = options

  let snapshot: PlansSnapshot | undefined
  let inFlight: InFlightRead | undefined
  const lifetime = { disposed: false }
  const scopeTracker = createBillingScopeTracker(scopeSource, () => {
    snapshot = undefined
    inFlight = undefined
  })

  async function requestPlans(
    scope: PlansScope,
    timeoutMs: number | undefined
  ): Promise<BillingResult<PlansSnapshot>> {
    const request: BillingRequest = {
      method: 'GET',
      route: PLANS_ROUTE,
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    }
    const response = await readValidatedBillingResponse(
      transport,
      request,
      (body) => zGetBillingPlansResponse.safeParse(body)
    )
    if (response.status === 'error') return response

    return {
      status: 'ok',
      value: { scope, data: response.value.data, readAt: now() }
    }
  }

  async function read(
    readOptions?: PlansReadOptions
  ): Promise<BillingResult<PlansSnapshot>> {
    if (lifetime.disposed) return { status: 'error', code: 'SUPERSEDED' }

    const context = scopeTracker.capture()
    if (context === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    const { scope } = context

    if (matchesScopedRead(inFlight, context)) {
      return releaseOnAbort(inFlight.promise, readOptions?.signal)
    }

    // No caller signal reaches the shared request: it is bounded by its own
    // timeout, and one caller walking away must not fail the readers still
    // waiting on it. Each caller's signal releases only that caller, below.
    const attempt: InFlightRead = {
      context,
      promise: (async () => {
        const result = await requestPlans(scope, readOptions?.timeoutMs)
        if (result.status !== 'ok') {
          if (
            result.code === 'ACCESS_DENIED' &&
            scopeTracker.isCurrent(context)
          ) {
            snapshot = undefined
          }
          return result
        }

        // A catalog that arrives after the host moved to another workspace was
        // resolved for eligibility the current actor no longer has.
        if (lifetime.disposed || !scopeTracker.isCurrent(context)) {
          return { status: 'error', code: 'SUPERSEDED' }
        }

        snapshot = result.value
        return result
      })()
    }

    inFlight = attempt
    const release = () => {
      if (inFlight === attempt) inFlight = undefined
    }
    attempt.promise.then(release, release)

    return releaseOnAbort(attempt.promise, readOptions?.signal)
  }

  return {
    read,
    getSnapshot: () => snapshot,
    dispose: () => {
      lifetime.disposed = true
      snapshot = undefined
      inFlight = undefined
      scopeTracker.dispose()
    }
  }
}
