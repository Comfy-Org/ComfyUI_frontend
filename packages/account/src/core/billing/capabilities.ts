/**
 * The capabilities read: a server-authoritative answer to "what may this actor
 * be offered for this workspace", cached per scope.
 *
 * The SDK never derives a capability. It decodes what the server resolved and
 * caches it under the scope it was resolved for, so no entitlement rule is
 * reimplemented here and none can drift from the backend's.
 *
 * Freshness is pull-based on purpose: a snapshot carries the instant it stops
 * being fresh, and a caller learns it is stale by asking. The production
 * composable's timer, its visibility gating, and its retry backoff are all
 * push concerns that need a document and a scheduler, so they belong to the
 * view package that has both — not to a framework-free core.
 */
import {
  zBillingCapabilities,
  zBillingCapabilityRolloutDefaults,
  zBillingCapabilityScope
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { BillingScope, BillingScopeSource } from './billingScope.js'
import { sameBillingScope } from './billingScope.js'
import type { CapabilityDenials } from './capabilityDenials.js'
import { decodeCapabilityDenials } from './capabilityDenials.js'
import { createScopedReader } from './scopedReader.js'
import type { ValidatedBillingResponse } from './sharedRead.js'

export const CAPABILITIES_ROUTE = '/billing/capabilities'

/** Production's own budget for this read (`workspaceApi.getBillingCapabilities`). */
const CAPABILITIES_TIMEOUT_MS = 10_000

/**
 * A remaining lifetime below the floor means the client clock disagrees with
 * the server's, so `expires_at` cannot pace anything and the fixed interval is
 * used instead. The ceiling bounds the opposite skew, where a lagging clock
 * reads `expires_at` as far in the future. Both bounds, and the fallback, are
 * the production composable's.
 */
const MIN_FRESH_MS = 5_000
const MAX_FRESH_MS = 60 * 60 * 1000
const FALLBACK_FRESH_MS = 60_000

export const CAPABILITY_REVISION_HEADER = 'X-Capability-Revision'

export type BillingCapabilities = z.infer<typeof zBillingCapabilities>
export type CapabilityRolloutDefaults = z.infer<
  typeof zBillingCapabilityRolloutDefaults
>

/**
 * The generated contract minus `denied_reasons`, which is decoded separately
 * and leniently. `revision` is read as a number rather than the generated
 * bigint: the server bounds it to the JavaScript-safe range precisely so
 * clients can compare it as one.
 */
const CapabilitiesBodySchema = z.object({
  capabilities: zBillingCapabilities,
  expires_at: z.string(),
  resolved_for: zBillingCapabilityScope,
  revision: z.number(),
  rollout_defaults_applied: zBillingCapabilityRolloutDefaults
})

type CapabilitiesBody = z.infer<typeof CapabilitiesBodySchema>

export type CapabilityScope = BillingScope

export interface CapabilitiesSnapshot {
  readonly capabilities: BillingCapabilities
  /**
   * Present only for a capability the server refused and explained. An absent
   * key never implies the capability was granted — read `capabilities`.
   */
  readonly denials: CapabilityDenials
  /** True values are rollout guidance, not evidence a write will succeed. */
  readonly rolloutDefaultsApplied: CapabilityRolloutDefaults
  readonly revision: number
  readonly scope: CapabilityScope
  /** ms since epoch, after which `read` refetches rather than serving this. */
  readonly freshUntil: number
}

export interface CapabilitiesReadOptions {
  readonly signal?: AbortSignal
  /** Bypasses a fresh cached snapshot; still joins an in-flight read. */
  readonly forceRefresh?: boolean
}

export interface CapabilitiesReader {
  read: (
    options?: CapabilitiesReadOptions
  ) => Promise<BillingResult<CapabilitiesSnapshot>>
  /** The cached snapshot for the current scope, fresh or not. */
  getSnapshot: () => CapabilitiesSnapshot | undefined
  /**
   * Marks the cache stale for a revision a **mutation** reported. A read's own
   * revision must never be fed back here: the capabilities response echoes the
   * header it was built with, so republishing it would mark that read stale and
   * refetch forever.
   */
  invalidate: (revision?: number) => void
  /** Detaches the scope subscription. */
  dispose: () => void
}

export interface CapabilitiesReaderOptions {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

/**
 * Reads the revision a mutation reported. Absent whenever CORS is bypassed
 * (local desktop origins), so a missing header is "nothing reported" rather
 * than a reason to invalidate.
 */
export function readCapabilityRevision(
  header: (name: string) => string | null
): number | undefined {
  const raw = header(CAPABILITY_REVISION_HEADER)
  if (raw === null) return undefined
  const revision = Number(raw)
  return Number.isSafeInteger(revision) && revision > 0 ? revision : undefined
}

function freshUntilFrom(expiresAt: string, now: number): number {
  // Date.parse yields NaN on an unparseable value; NaN fails the comparison
  // and lands on the fixed interval, which is the intended branch.
  const remaining = Date.parse(expiresAt) - now
  if (remaining >= MIN_FRESH_MS) {
    return now + Math.min(remaining, MAX_FRESH_MS)
  }
  return now + FALLBACK_FRESH_MS
}

function freshSnapshot(
  snapshot: CapabilitiesSnapshot | undefined,
  scope: CapabilityScope,
  forceRefresh: boolean,
  now: number
): CapabilitiesSnapshot | undefined {
  if (forceRefresh || snapshot === undefined) return undefined
  if (!sameBillingScope(snapshot.scope, scope)) return undefined
  return snapshot.freshUntil > now ? snapshot : undefined
}

function snapshotAfterInvalidation(
  snapshot: CapabilitiesSnapshot,
  invalidated: boolean
): CapabilitiesSnapshot {
  return invalidated ? { ...snapshot, freshUntil: 0 } : snapshot
}

export function createCapabilitiesReader(
  options: CapabilitiesReaderOptions
): CapabilitiesReader {
  const { transport, scopeSource, now = Date.now } = options

  function projectCapabilities(
    response: ValidatedBillingResponse<CapabilitiesBody>,
    scope: CapabilityScope
  ): BillingResult<CapabilitiesSnapshot> {
    const { data, body, httpStatus } = response

    // Capabilities resolve per (user, workspace), so both halves have to
    // match. Checking only the workspace would accept another member's answer
    // for the workspace the caller is in and publish it as the caller's own —
    // an actor with fewer or greater rights deciding what this one is offered.
    // Either mismatch is a contract violation rather than an answer about this
    // scope, so it joins the transient bucket instead of being cached. The
    // ingest service makes the same two-part check against its own upstream
    // before it forwards a response.
    const resolved = data.resolved_for
    if (
      resolved.user_id !== scope.userId ||
      resolved.workspace_id !== scope.workspaceId
    ) {
      return { status: 'error', code: 'REQUEST_FAILED', httpStatus }
    }

    const denials = decodeCapabilityDenials(
      (body as { denied_reasons?: unknown }).denied_reasons
    )

    return {
      status: 'ok',
      value: {
        capabilities: data.capabilities,
        denials,
        rolloutDefaultsApplied: data.rollout_defaults_applied,
        revision: data.revision,
        scope,
        freshUntil: freshUntilFrom(data.expires_at, now())
      }
    }
  }

  const reader = createScopedReader<
    CapabilitiesBody,
    CapabilitiesSnapshot,
    CapabilitiesReadOptions
  >({
    transport,
    scopeSource,
    route: CAPABILITIES_ROUTE,
    parse: (body) => CapabilitiesBodySchema.safeParse(body),
    timeoutMs: () => CAPABILITIES_TIMEOUT_MS,
    cached: (snapshot, scope, readOptions) =>
      freshSnapshot(snapshot, scope, readOptions?.forceRefresh === true, now()),
    project: projectCapabilities,
    // A mutation committed while this read was in flight, and the revision the
    // read returns cannot rule out having missed it: the server mints that
    // number when it serializes, not when it read. The value is still the best
    // available, so it is published — as already stale, so the next read
    // refetches instead of serving it.
    publish: snapshotAfterInvalidation
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    invalidate: (revision?: number) => {
      reader.fenceInFlight()
      const snapshot = reader.getSnapshot()
      if (snapshot === undefined) return
      if (revision !== undefined && snapshot.revision === revision) return
      reader.setSnapshot({ ...snapshot, freshUntil: 0 })
    },
    dispose: reader.dispose
  }
}
