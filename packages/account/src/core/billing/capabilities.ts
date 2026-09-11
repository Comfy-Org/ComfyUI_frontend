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

import type { SessionClient } from '../session.js'
import type { BillingResult, BillingTransport } from './billingContracts.js'
import type { CapabilityDenials } from './capabilityDenials.js'
import { decodeCapabilityDenials } from './capabilityDenials.js'
import { codeForHttpStatus } from './httpStatus.js'
import { releaseOnAbort } from './sharedRead.js'

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

export interface CapabilityScope {
  readonly userId: string
  readonly workspaceId: string
}

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
  /** Detaches the session subscription. */
  dispose: () => void
}

export interface CapabilitiesReaderOptions {
  readonly transport: BillingTransport
  readonly session: SessionClient
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

interface InFlightRead {
  readonly scope: CapabilityScope
  readonly promise: Promise<BillingResult<CapabilitiesSnapshot>>
  readonly pending: { invalidated: boolean }
}

export function createCapabilitiesReader(
  options: CapabilitiesReaderOptions
): CapabilitiesReader {
  const { transport, session, now = Date.now } = options

  let snapshot: CapabilitiesSnapshot | undefined
  let inFlight: InFlightRead | undefined

  /** The scope a read runs for, or undefined when nobody is signed in. */
  const currentScope = (): CapabilityScope | undefined => {
    const state = session.getSnapshot()
    if (state.user === null || state.session === undefined) return undefined
    return {
      userId: state.user.uid,
      workspaceId: state.session.workspace.id
    }
  }

  const sameScope = (a: CapabilityScope, b: CapabilityScope): boolean =>
    a.userId === b.userId && a.workspaceId === b.workspaceId

  // A scope change makes a snapshot wrong rather than stale, so it is dropped
  // outright; keeping it would let one workspace's affordances show under
  // another's until the next read settled.
  const unsubscribe = session.subscribe(() => {
    if (snapshot === undefined) return
    const scope = currentScope()
    if (scope === undefined || !sameScope(scope, snapshot.scope)) {
      snapshot = undefined
    }
  })

  const requestCapabilities = async (
    scope: CapabilityScope,
    signal: AbortSignal | undefined
  ): Promise<BillingResult<CapabilitiesSnapshot>> => {
    const response = await transport({
      method: 'GET',
      route: CAPABILITIES_ROUTE,
      timeoutMs: CAPABILITIES_TIMEOUT_MS,
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

    const parsed = CapabilitiesBodySchema.safeParse(body)
    if (!parsed.success) {
      return { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus }
    }

    // Capabilities resolve per (user, workspace), so both halves have to
    // match. Checking only the workspace would accept another member's answer
    // for the workspace the caller is in and publish it as the caller's own —
    // an actor with fewer or greater rights deciding what this one is offered.
    // Either mismatch is a contract violation rather than an answer about this
    // scope, so it joins the transient bucket instead of being cached. The
    // ingest service makes the same two-part check against its own upstream
    // before it forwards a response.
    const resolved = parsed.data.resolved_for
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
        capabilities: parsed.data.capabilities,
        denials,
        rolloutDefaultsApplied: parsed.data.rollout_defaults_applied,
        revision: parsed.data.revision,
        scope,
        freshUntil: freshUntilFrom(parsed.data.expires_at, now())
      }
    }
  }

  const read = async (
    readOptions?: CapabilitiesReadOptions
  ): Promise<BillingResult<CapabilitiesSnapshot>> => {
    const scope = currentScope()
    if (scope === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    if (
      readOptions?.forceRefresh !== true &&
      snapshot !== undefined &&
      sameScope(snapshot.scope, scope) &&
      snapshot.freshUntil > now()
    ) {
      return { status: 'ok', value: snapshot }
    }

    // One read per scope. A caller arriving mid-flight for the same scope
    // joins rather than issuing a second identical request; a caller for a
    // different scope starts its own, and the older one can no longer publish.
    if (inFlight !== undefined && sameScope(inFlight.scope, scope)) {
      return releaseOnAbort(inFlight.promise, readOptions?.signal)
    }

    // The invalidation flag lives outside the attempt so the read body can
    // consult it without referencing the object that holds its own promise.
    const pending = { invalidated: false }
    // No caller signal reaches the shared request: it is bounded by its own
    // timeout, and one caller walking away must not fail the readers still
    // waiting on it. Each caller's signal releases only that caller, below.
    const promise = (async (): Promise<BillingResult<CapabilitiesSnapshot>> => {
      const result = await requestCapabilities(scope, undefined)
      if (result.status !== 'ok') return result

      // The publish guard. Between issuing the request and settling it the
      // host may have changed workspace or signed out, and a snapshot cached
      // now would be attributed to whoever is signed in next.
      const settledScope = currentScope()
      if (settledScope === undefined || !sameScope(settledScope, scope)) {
        return { status: 'error', code: 'SUPERSEDED' }
      }

      // A mutation committed while this read was in flight, and the revision
      // the read returns cannot rule out having missed it: the server mints
      // that number when it serializes, not when it read. The value is still
      // the best available, so it is published — as already stale, so the
      // next read refetches instead of serving it.
      snapshot = pending.invalidated
        ? { ...result.value, freshUntil: 0 }
        : result.value
      return { status: 'ok', value: snapshot }
    })()

    const attempt: InFlightRead = { scope, promise, pending }
    inFlight = attempt
    // The slot is released when the request settles, not when this caller
    // stops waiting, so an abandoned read still serves whoever joined it.
    const release = () => {
      if (inFlight === attempt) inFlight = undefined
    }
    promise.then(release, release)

    return releaseOnAbort(promise, readOptions?.signal)
  }

  return {
    read,
    getSnapshot: () => snapshot,
    invalidate: (revision?: number) => {
      if (inFlight !== undefined) inFlight.pending.invalidated = true
      if (snapshot === undefined) return
      if (revision !== undefined && snapshot.revision === revision) return
      snapshot = { ...snapshot, freshUntil: 0 }
    },
    dispose: unsubscribe
  }
}
