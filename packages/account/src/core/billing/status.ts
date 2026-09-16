import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { createScopedReader } from './scopedReader.js'

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
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

export function createBillingStatusReader(
  options: BillingStatusReaderOptions
): BillingStatusReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    BillingStatusData,
    BillingStatusSnapshot,
    BillingStatusReadOptions
  >({
    transport,
    scopeSource,
    route: BILLING_STATUS_ROUTE,
    parse: (body) => zBillingStatusResponse.safeParse(body),
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { status: data, scope, readAt: now() }
    })
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}
