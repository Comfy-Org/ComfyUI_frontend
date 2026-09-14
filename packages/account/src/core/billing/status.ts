import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { SessionClient } from '../session.js'
import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeContext } from './billingScope.js'
import { createBillingScopeTracker } from './billingScope.js'
import {
  matchesScopedRead,
  readValidatedBillingResponse,
  releaseOnAbort
} from './sharedRead.js'

export const BILLING_STATUS_ROUTE = '/billing/status'

export type BillingStatusData = z.infer<typeof zBillingStatusResponse>

export type BillingStatusScope = BillingScope

export interface BillingStatusSnapshot {
  readonly status: BillingStatusData
  readonly scope: BillingStatusScope
  readonly readAt: number
}

export interface BillingStatusReadOptions {
  readonly signal?: AbortSignal
}

export interface BillingStatusReader {
  read: (
    options?: BillingStatusReadOptions
  ) => Promise<BillingResult<BillingStatusSnapshot>>
  getSnapshot: () => BillingStatusSnapshot | undefined
  dispose: () => void
}

export interface BillingStatusReaderOptions {
  readonly transport: BillingTransport
  readonly session: SessionClient
  readonly now?: () => number
}

interface InFlightRead {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<BillingStatusSnapshot>>
}

export function createBillingStatusReader(
  options: BillingStatusReaderOptions
): BillingStatusReader {
  const { transport, session, now = Date.now } = options

  let snapshot: BillingStatusSnapshot | undefined
  let inFlight: InFlightRead | undefined
  const lifetime = { disposed: false }
  const scopeTracker = createBillingScopeTracker(session, () => {
    snapshot = undefined
    inFlight = undefined
  })

  async function requestStatus(
    scope: BillingStatusScope
  ): Promise<BillingResult<BillingStatusSnapshot>> {
    const response = await readValidatedBillingResponse(
      transport,
      { method: 'GET', route: BILLING_STATUS_ROUTE },
      (body) => zBillingStatusResponse.safeParse(body)
    )
    if (response.status === 'error') return response

    return {
      status: 'ok',
      value: { status: response.value.data, scope, readAt: now() }
    }
  }

  async function read(
    readOptions?: BillingStatusReadOptions
  ): Promise<BillingResult<BillingStatusSnapshot>> {
    if (lifetime.disposed) return { status: 'error', code: 'SUPERSEDED' }

    const context = scopeTracker.capture()
    if (context === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
    const { scope } = context

    if (matchesScopedRead(inFlight, context)) {
      return releaseOnAbort(inFlight.promise, readOptions?.signal)
    }

    const attempt: InFlightRead = {
      context,
      promise: (async () => {
        const result = await requestStatus(scope)
        if (result.status !== 'ok') {
          if (
            result.code === 'ACCESS_DENIED' &&
            scopeTracker.isCurrent(context)
          ) {
            snapshot = undefined
          }
          return result
        }

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
