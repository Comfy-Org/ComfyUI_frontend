import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { SessionClient } from '../session.js'
import type { BillingResult, BillingTransport } from './billingContracts.js'
import { codeForHttpStatus } from './httpStatus.js'
import { releaseOnAbort } from './sharedRead.js'

export const BILLING_STATUS_ROUTE = '/billing/status'

export type BillingStatusData = z.infer<typeof zBillingStatusResponse>

export interface BillingStatusScope {
  readonly userId: string
  readonly workspaceId: string
}

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
  readonly scope: BillingStatusScope
  readonly promise: Promise<BillingResult<BillingStatusSnapshot>>
}

export function createBillingStatusReader(
  options: BillingStatusReaderOptions
): BillingStatusReader {
  const { transport, session, now = Date.now } = options

  let snapshot: BillingStatusSnapshot | undefined
  let inFlight: InFlightRead | undefined

  function currentScope(): BillingStatusScope | undefined {
    const state = session.getSnapshot()
    if (state.user === null || state.session === undefined) return undefined
    return {
      userId: state.user.uid,
      workspaceId: state.session.workspace.id
    }
  }

  function sameScope(a: BillingStatusScope, b: BillingStatusScope): boolean {
    return a.userId === b.userId && a.workspaceId === b.workspaceId
  }

  const unsubscribe = session.subscribe(() => {
    if (snapshot === undefined) return
    const scope = currentScope()
    if (scope === undefined || !sameScope(scope, snapshot.scope)) {
      snapshot = undefined
    }
  })

  async function requestStatus(
    scope: BillingStatusScope
  ): Promise<BillingResult<BillingStatusSnapshot>> {
    const response = await transport({
      method: 'GET',
      route: BILLING_STATUS_ROUTE
    })
    if (response.status === 'error') return response

    const { httpStatus, body } = response.value
    if (httpStatus < 200 || httpStatus >= 300) {
      return {
        status: 'error',
        code: codeForHttpStatus(httpStatus),
        httpStatus
      }
    }

    const parsed = zBillingStatusResponse.safeParse(body)
    if (!parsed.success) {
      return { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus }
    }

    return {
      status: 'ok',
      value: { status: parsed.data, scope, readAt: now() }
    }
  }

  async function read(
    readOptions?: BillingStatusReadOptions
  ): Promise<BillingResult<BillingStatusSnapshot>> {
    const scope = currentScope()
    if (scope === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    if (inFlight !== undefined && sameScope(inFlight.scope, scope)) {
      return releaseOnAbort(inFlight.promise, readOptions?.signal)
    }

    const attempt: InFlightRead = {
      scope,
      promise: (async () => {
        const result = await requestStatus(scope)
        if (result.status !== 'ok') return result

        const settledScope = currentScope()
        if (settledScope === undefined || !sameScope(settledScope, scope)) {
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
    dispose: unsubscribe
  }
}
