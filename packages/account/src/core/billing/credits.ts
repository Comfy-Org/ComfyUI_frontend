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

import type { SessionClient } from '../session.js'
import type { BillingResult, BillingTransport } from './billingContracts.js'
import { codeForHttpStatus } from './httpStatus.js'

export const CREDITS_ROUTE = '/billing/balance'

export type BillingBalance = z.infer<typeof zBillingBalanceResponse>

export interface CreditsScope {
  readonly userId: string
  readonly workspaceId: string
}

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
  readonly session: SessionClient
  readonly now?: () => number
}

interface InFlightRead {
  readonly scope: CreditsScope
  readonly promise: Promise<BillingResult<CreditsSnapshot>>
}

export function createCreditsReader(
  options: CreditsReaderOptions
): CreditsReader {
  const { transport, session, now = Date.now } = options

  let snapshot: CreditsSnapshot | undefined
  let inFlight: InFlightRead | undefined

  const currentScope = (): CreditsScope | undefined => {
    const state = session.getSnapshot()
    if (state.user === null || state.session === undefined) return undefined
    return {
      userId: state.user.uid,
      workspaceId: state.session.workspace.id
    }
  }

  const sameScope = (a: CreditsScope, b: CreditsScope): boolean =>
    a.userId === b.userId && a.workspaceId === b.workspaceId

  const unsubscribe = session.subscribe(() => {
    if (snapshot === undefined) return
    const scope = currentScope()
    if (scope === undefined || !sameScope(scope, snapshot.scope)) {
      snapshot = undefined
    }
  })

  const requestBalance = async (
    scope: CreditsScope,
    signal: AbortSignal | undefined
  ): Promise<BillingResult<CreditsSnapshot>> => {
    const response = await transport({
      method: 'GET',
      route: CREDITS_ROUTE,
      ...(signal === undefined ? {} : { signal })
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

    const parsed = zBillingBalanceResponse.safeParse(body)
    if (!parsed.success) {
      return { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus }
    }

    return {
      status: 'ok',
      value: { balance: parsed.data, scope, readAt: now() }
    }
  }

  const read = async (
    readOptions?: CreditsReadOptions
  ): Promise<BillingResult<CreditsSnapshot>> => {
    const scope = currentScope()
    if (scope === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    if (inFlight !== undefined && sameScope(inFlight.scope, scope)) {
      return inFlight.promise
    }

    const attempt: InFlightRead = {
      scope,
      promise: (async () => {
        const result = await requestBalance(scope, readOptions?.signal)
        if (result.status !== 'ok') return result

        // The publish guard: a balance that arrives after the host moved to
        // another workspace or signed out belongs to neither, and showing it
        // would state one account's credits under another's name.
        const settledScope = currentScope()
        if (settledScope === undefined || !sameScope(settledScope, scope)) {
          return { status: 'error', code: 'SUPERSEDED' }
        }

        snapshot = result.value
        return result
      })()
    }

    inFlight = attempt
    try {
      return await attempt.promise
    } finally {
      if (inFlight === attempt) inFlight = undefined
    }
  }

  return {
    read,
    getSnapshot: () => snapshot,
    dispose: unsubscribe
  }
}
