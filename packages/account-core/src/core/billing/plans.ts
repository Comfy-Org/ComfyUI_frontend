/**
 * The plans read: the catalog a workspace may subscribe to, cached per scope.
 *
 * Availability, seat costs, and the credit-stop ladder are all resolved by the
 * server for the actor that asked, so the response is cached under the scope it
 * was resolved for and no plan is filtered, ranked, or priced here.
 */
import { zGetBillingPlansResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { createScopedReader } from './scopedReader.js'

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

export function createPlansReader(options: PlansReaderOptions): PlansReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    BillingPlansData,
    PlansSnapshot,
    PlansReadOptions
  >({
    transport,
    scopeSource,
    route: PLANS_ROUTE,
    parse: (body) => zGetBillingPlansResponse.safeParse(body),
    timeoutMs: (readOptions) => readOptions?.timeoutMs,
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { scope, data, readAt: now() }
    })
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}
