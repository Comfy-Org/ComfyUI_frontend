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

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { createScopedReader } from './scopedReader.js'

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
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

export function createCreditsReader(
  options: CreditsReaderOptions
): CreditsReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    BillingBalance,
    CreditsSnapshot,
    CreditsReadOptions
  >({
    transport,
    scopeSource,
    route: CREDITS_ROUTE,
    parse: (body) => zBillingBalanceResponse.safeParse(body),
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { balance: data, scope, readAt: now() }
    })
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}
