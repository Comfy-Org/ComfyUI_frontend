/**
 * The plans read: the catalog a workspace may subscribe to, cached per scope.
 *
 * Availability, seat costs, and the credit-stop ladder are all resolved by the
 * server for the actor that asked, so the response is cached under the scope it
 * was resolved for and no plan is filtered, ranked, or priced here.
 */
import {
  zGetBillingPlansResponse,
  zPlanFeatureItem
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts'
import type { BillingScope, BillingScopeSource } from './billingScope'
import { createScopedReader } from './scopedReader'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function filterUnreadableFeatureItems(plan: unknown): unknown {
  if (!isRecord(plan) || !Array.isArray(plan.feature_items)) return plan
  return {
    ...plan,
    feature_items: plan.feature_items.filter(
      (item) => zPlanFeatureItem.safeParse(item).success
    )
  }
}

function filterUnreadablePlanFeatures(body: unknown): unknown {
  if (!isRecord(body) || !Array.isArray(body.plans)) return body
  return { ...body, plans: body.plans.map(filterUnreadableFeatureItems) }
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
    parse: (body) =>
      zGetBillingPlansResponse.safeParse(filterUnreadablePlanFeatures(body)),
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
