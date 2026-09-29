/**
 * The billing events read: one page of the workspace's history feed, the
 * charges, credits and adjustments behind the usage log.
 *
 * It is the only billing read whose request varies per call, so the page it
 * asks for is part of what identifies the read: two callers on different
 * pages each get their own answer rather than sharing the first one's. The
 * snapshot reports the page the server says it served, not the one that was
 * asked for, because the endpoint clamps a page past the end.
 */
import { zGetBillingEventsResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { createScopedReader } from './scopedReader.js'

export const BILLING_EVENTS_ROUTE = '/billing/events'

export type BillingEventsData = z.infer<typeof zGetBillingEventsResponse>
export type BillingEvent = BillingEventsData['events'][number]

export type BillingEventsScope = BillingScope

export interface BillingEventsSnapshot {
  readonly events: readonly BillingEvent[]
  /** 1-indexed, as the endpoint counts. */
  readonly page: number
  readonly limit: number
  readonly total: number
  readonly totalPages: number
  readonly scope: BillingEventsScope
  readonly readAt: number
}

export interface BillingEventsReadOptions {
  readonly signal?: AbortSignal
  /** 1-indexed; the endpoint's own default applies when omitted. */
  readonly page?: number
  readonly limit?: number
}

export interface BillingEventsReader {
  read: (
    options?: BillingEventsReadOptions
  ) => Promise<BillingResult<BillingEventsSnapshot>>
  /** The last page read for the current scope; it carries which page it is. */
  getSnapshot: () => BillingEventsSnapshot | undefined
  dispose: () => void
}

export interface BillingEventsReaderOptions {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

/** Stable key order, so the same page asked for twice is the same request. */
function billingEventsRoute(
  options: BillingEventsReadOptions | undefined
): string {
  const query = new URLSearchParams()
  if (options?.page !== undefined) query.set('page', String(options.page))
  if (options?.limit !== undefined) query.set('limit', String(options.limit))
  const search = query.toString()
  return search === ''
    ? BILLING_EVENTS_ROUTE
    : `${BILLING_EVENTS_ROUTE}?${search}`
}

export function createBillingEventsReader(
  options: BillingEventsReaderOptions
): BillingEventsReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    BillingEventsData,
    BillingEventsSnapshot,
    BillingEventsReadOptions
  >({
    transport,
    scopeSource,
    route: billingEventsRoute,
    parse: (body) => zGetBillingEventsResponse.safeParse(body),
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { ...data, scope, readAt: now() }
    })
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}
