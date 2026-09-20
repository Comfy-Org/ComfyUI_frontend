/**
 * The one shape every billing read has: capture the scope, issue a validated
 * request, and refuse to attribute the answer to a scope that has since taken
 * over. Only the route, the decoder, and the projection into a snapshot differ
 * between reads, so only those live in the readers.
 *
 * What the skeleton owns is what a reader therefore cannot get wrong on its
 * own: one shared request per scope, a caller's signal releasing only that
 * caller, the publish fence that reports a late answer as `SUPERSEDED`, and
 * the denial that drops a published snapshot unless it predates a change the
 * host reported.
 */
import type {
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type {
  BillingScope,
  BillingScopeContext,
  BillingScopeSource
} from './billingScope.js'
import { createBillingScopeTracker } from './billingScope.js'
import type {
  ParsedBillingBody,
  ValidatedBillingResponse
} from './sharedRead.js'
import {
  matchesScopedRead,
  readValidatedBillingResponse,
  releaseOnAbort
} from './sharedRead.js'

/** Every reader's read options carry at least the caller's release signal. */
export interface ScopedReadOptions {
  readonly signal?: AbortSignal
}

export interface ScopedReaderDefinition<
  TData,
  TSnapshot,
  TOptions extends ScopedReadOptions
> {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  readonly route: string
  readonly parse: (body: unknown) => ParsedBillingBody<TData>
  /**
   * The reader's own reading of a validated response. Returning a failure is
   * how a reader refuses an answer its decoder alone cannot reject.
   */
  readonly project: (
    response: ValidatedBillingResponse<TData>,
    scope: BillingScope
  ) => BillingResult<TSnapshot>
  /** The request budget, for a read that bounds itself or lets its caller. */
  readonly timeoutMs?: (options: TOptions | undefined) => number | undefined
  /**
   * The published snapshot this call may be served from instead of asking.
   * Absent for a reader that always requests.
   */
  readonly cached?: (
    snapshot: TSnapshot | undefined,
    scope: BillingScope,
    options: TOptions | undefined
  ) => TSnapshot | undefined
  /**
   * What to publish once the read settles in scope, given whether the host
   * fenced the request while it was in flight. `undefined` publishes nothing,
   * and the callers waiting on the request are still served what it read.
   */
  readonly publish?: (
    value: TSnapshot,
    fenced: boolean
  ) => TSnapshot | undefined
}

export interface ScopedReader<TSnapshot, TOptions extends ScopedReadOptions> {
  readonly read: (options?: TOptions) => Promise<BillingResult<TSnapshot>>
  readonly getSnapshot: () => TSnapshot | undefined
  /** Replaces what `getSnapshot` publishes; `undefined` drops it. */
  readonly setSnapshot: (snapshot: TSnapshot | undefined) => void
  /**
   * Marks a request already in flight as predating a change the host is
   * reporting, leaving `publish` to decide what its answer is still worth.
   * `detach` also frees the shared slot, so the read that follows issues its
   * own request rather than joining the one that predates the change.
   */
  readonly fenceInFlight: (options?: { readonly detach?: boolean }) => void
  readonly dispose: () => void
}

interface InFlightRead<TSnapshot> {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<TSnapshot>>
  /**
   * Lives outside the attempt so the read body can consult it without
   * referencing the object that holds its own promise.
   */
  readonly pending: { fenced: boolean }
}

function publishAsRead<TSnapshot>(value: TSnapshot): TSnapshot {
  return value
}

export function createScopedReader<
  TData,
  TSnapshot,
  TOptions extends ScopedReadOptions
>(
  definition: ScopedReaderDefinition<TData, TSnapshot, TOptions>
): ScopedReader<TSnapshot, TOptions> {
  const {
    transport,
    scopeSource,
    route,
    parse,
    project,
    timeoutMs,
    cached,
    publish = publishAsRead
  } = definition

  let snapshot: TSnapshot | undefined
  let inFlight: InFlightRead<TSnapshot> | undefined
  const lifetime = { disposed: false }
  const scopeTracker = createBillingScopeTracker(scopeSource, () => {
    snapshot = undefined
    inFlight = undefined
  })

  async function request(
    scope: BillingScope,
    options: TOptions | undefined
  ): Promise<BillingResult<TSnapshot>> {
    const budget = timeoutMs?.(options)
    const billingRequest: BillingRequest = {
      method: 'GET',
      route,
      ...(budget === undefined ? {} : { timeoutMs: budget })
    }
    const response = await readValidatedBillingResponse(
      transport,
      billingRequest,
      parse
    )
    if (response.status === 'error') return response

    return project(response.value, scope)
  }

  function publishSettled(
    value: TSnapshot,
    fenced: boolean
  ): BillingResult<TSnapshot> {
    const published = publish(value, fenced)
    if (published !== undefined) snapshot = published
    return { status: 'ok', value: published ?? value }
  }

  async function settle(
    context: BillingScopeContext,
    pending: { fenced: boolean },
    options: TOptions | undefined
  ): Promise<BillingResult<TSnapshot>> {
    const result = await request(context.scope, options)
    // The publish guard. Between issuing the request and settling it the host
    // may have changed workspace or signed out, so an answer cached now would
    // be attributed to whoever is signed in next, and a failure says nothing
    // about the scope that has since taken over.
    if (lifetime.disposed || !scopeTracker.isCurrent(context)) {
      return { status: 'error', code: 'SUPERSEDED' }
    }

    if (result.status !== 'ok') {
      // A denial that predates a fence is no evidence about what a later read
      // published, and clearing on it would drop a fresh answer for a stale
      // refusal.
      if (result.code === 'ACCESS_DENIED' && !pending.fenced) {
        snapshot = undefined
      }
      return result
    }

    return publishSettled(result.value, pending.fenced)
  }

  async function read(options?: TOptions): Promise<BillingResult<TSnapshot>> {
    if (lifetime.disposed) return { status: 'error', code: 'SUPERSEDED' }

    const context = scopeTracker.capture()
    if (context === undefined) {
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }

    const served = cached?.(snapshot, context.scope, options)
    if (served !== undefined) return { status: 'ok', value: served }

    // One read per scope. A caller arriving mid-flight for the same scope
    // joins rather than issuing a second identical request; a caller for a
    // different scope starts its own, and the older one can no longer publish.
    if (matchesScopedRead(inFlight, context)) {
      return releaseOnAbort(inFlight.promise, options?.signal)
    }

    // No caller signal reaches the shared request: it is bounded by its own
    // timeout, and one caller walking away must not fail the readers still
    // waiting on it. Each caller's signal releases only that caller, below.
    const pending = { fenced: false }
    const attempt: InFlightRead<TSnapshot> = {
      context,
      promise: settle(context, pending, options),
      pending
    }

    inFlight = attempt
    // The slot is released when the request settles, not when this caller
    // stops waiting, so an abandoned read still serves whoever joined it.
    const release = () => {
      if (inFlight === attempt) inFlight = undefined
    }
    attempt.promise.then(release, release)

    return releaseOnAbort(attempt.promise, options?.signal)
  }

  return {
    read,
    getSnapshot: () => snapshot,
    setSnapshot: (next) => {
      snapshot = next
    },
    fenceInFlight: (fenceOptions) => {
      if (inFlight === undefined) return
      inFlight.pending.fenced = true
      if (fenceOptions?.detach === true) inFlight = undefined
    },
    dispose: () => {
      lifetime.disposed = true
      snapshot = undefined
      inFlight = undefined
      scopeTracker.dispose()
    }
  }
}
