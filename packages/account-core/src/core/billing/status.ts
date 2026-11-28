import {
  zBillingStatusResponse,
  zSubscriptionTier
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts'
import type { BillingScope, BillingScopeSource } from './billingScope'
import { createScopedReader } from './scopedReader'

export const BILLING_STATUS_ROUTE = '/billing/status'

const BillingStatusBodySchema = zBillingStatusResponse.extend({
  ended_at: zBillingStatusResponse.shape.ended_at.optional(),
  next_charge: zBillingStatusResponse.shape.next_charge.optional()
})

function withoutUnsupportedTier(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body
  if (!('subscription_tier' in body)) return body
  const { subscription_tier: tier, ...rest } = body
  const unsupported =
    typeof tier === 'string' && !zSubscriptionTier.safeParse(tier).success
  return unsupported ? rest : body
}

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
   * Start a new request instead of joining one in flight. The older request
   * stops publishing.
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
    parse: (body) =>
      BillingStatusBodySchema.safeParse(withoutUnsupportedTier(body)),
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
