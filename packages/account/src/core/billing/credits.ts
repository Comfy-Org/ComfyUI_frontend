/**
 * The credits read: a workspace's balance, cached per scope.
 *
 * Balances are reported in micros and kept that way. Converting to a display
 * unit here would bake one currency's minor-unit assumption into the core and
 * lose precision before the host ever sees the number; formatting belongs to
 * the view layer, which has the locale.
 */
import { zBillingBalanceResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type {
  BillingResult,
  BillingSession,
  BillingTransport
} from './billingContracts.js'
import type { BillingScope, BillingScopeContext } from './billingScope.js'
import { createBillingScopeTracker } from './billingScope.js'
import {
  matchesScopedRead,
  readValidatedBillingResponse,
  releaseOnAbort
} from './sharedRead.js'

export const CREDITS_ROUTE = '/billing/balance'

export type BillingBalance = z.infer<typeof zBillingBalanceResponse>

export type CreditsScope = BillingScope

export interface CreditsSnapshot {
  readonly balance: BillingBalance
  readonly scope: CreditsScope
  /** ms since epoch at which this read settled. */
  readonly readAt: number
}

export interface CreditsReadOptions {
  readonly signal?: AbortSignal
}

export interface CreditsReader {
  /**
   * Always requests. A balance has no server-declared lifetime and moves on
   * every run, so there is no interval over which serving a cached one is
   * correct; the cache exists to survive a failure, not to skip a read.
   * Concurrent callers for one scope still share a single request.
   */
  read: (
    options?: CreditsReadOptions
  ) => Promise<BillingResult<CreditsSnapshot>>
  /** The last balance published for the current scope. */
  getSnapshot: () => CreditsSnapshot | undefined
  dispose: () => void
}

export interface CreditsReaderOptions {
  readonly transport: BillingTransport
  readonly session: BillingSession
  readonly now?: () => number
}

interface InFlightRead {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<CreditsSnapshot>>
}

export function createCreditsReader(
  options: CreditsReaderOptions
): CreditsReader {
  const { transport, session, now = Date.now } = options

  let snapshot: CreditsSnapshot | undefined
  let inFlight: InFlightRead | undefined
  const lifetime = { disposed: false }
  const scopeTracker = createBillingScopeTracker(session, () => {
    snapshot = undefined
    inFlight = undefined
  })

  const requestBalance = async (
    scope: CreditsScope
  ): Promise<BillingResult<CreditsSnapshot>> => {
    const response = await readValidatedBillingResponse(
      transport,
      { method: 'GET', route: CREDITS_ROUTE },
      (body) => zBillingBalanceResponse.safeParse(body)
    )
    if (response.status === 'error') return response

    return {
      status: 'ok',
      value: { balance: response.value.data, scope, readAt: now() }
    }
  }

  const read = async (
    readOptions?: CreditsReadOptions
  ): Promise<BillingResult<CreditsSnapshot>> => {
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
        const result = await requestBalance(scope)
        if (result.status !== 'ok') {
          if (
            result.code === 'ACCESS_DENIED' &&
            scopeTracker.isCurrent(context)
          ) {
            snapshot = undefined
          }
          return result
        }

        // The publish guard: a balance that arrives after the host moved to
        // another workspace or signed out belongs to neither, and showing it
        // would state one account's credits under another's name.
        if (lifetime.disposed || !scopeTracker.isCurrent(context)) {
          return { status: 'error', code: 'SUPERSEDED' }
        }

        snapshot = result.value
        return result
      })()
    }

    inFlight = attempt
    // The slot is released when the request settles, not when this caller
    // stops waiting, so an abandoned read still serves whoever joined it.
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
