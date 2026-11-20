import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts'
import type { BillingScope, BillingScopeSource } from './billingScope'
import { createScopedReader } from './scopedReader'

export const BILLING_STATUS_ROUTE = '/billing/status'

const BillingStatusBodySchema = zBillingStatusResponse.extend({
  ended_at: zBillingStatusResponse.shape.ended_at.optional(),
  next_charge: zBillingStatusResponse.shape.next_charge.optional(),
  subscription_tier: zBillingStatusResponse.shape.subscription_tier.or(
    z.string().transform(() => undefined)
  )
})

export type BillingStatusData = z.infer<typeof BillingStatusBodySchema>

export type BillingStatusScope = BillingScope

export interface BillingStatusSnapshot {
  readonly status: BillingStatusData
  readonly scope: BillingStatusScope
  readonly readAt: number
}

export interface BillingStatusReadOptions {
  readonly signal?: AbortSignal
  /**
   * Read after any request already in flight instead of joining it, for a
   * caller that knows a change landed after that request was issued. Its
   * answer no longer publishes, so it cannot overwrite the newer read.
   */
  readonly fresh?: boolean
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
    parse: (body) => BillingStatusBodySchema.safeParse(body),
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { status: data, scope, readAt: now() }
    }),
    publish: (value, fenced) => (fenced ? undefined : value)
  })

  return {
    read: (readOptions) => {
      if (readOptions?.fresh === true) reader.fenceInFlight({ detach: true })
      return reader.read(readOptions)
    },
    getSnapshot: reader.getSnapshot,
    dispose: reader.dispose
  }
}
