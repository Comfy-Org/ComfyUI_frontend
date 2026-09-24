import type { Op } from '@comfyorg/comfy-multi-player'

import type { PendingOpTracker } from './pendingOpTracker'

/**
 * An already-current forced reconcile that deferred (missing/busy session)
 * is retried this often, up to {@link ALREADY_CURRENT_RETRY_MAX_ATTEMPTS}
 * times, independent of any doc frame — a quiet channel sends nothing else
 * to piggyback the retry on.
 */
export const ALREADY_CURRENT_RETRY_INTERVAL_MS = 2_000
const ALREADY_CURRENT_RETRY_MAX_ATTEMPTS = 5

/**
 * ADR-CRDT-RECONCILE-0035 (a): the single owner of the pending-op ledger's
 * LINEAGE — which workflow's doc history its entries belong to — and of the
 * CATCH-UP BARRIER that settles them against doc state. Split out of
 * `useAgentCrdtFollower.ts` so lineage adoption/invalidation and catch-up
 * settlement have one focused home instead of synchronized branches spread
 * across tracker state, projection watermarks and activation handlers.
 *
 * Deliberately independent of tab activation: a lineage break (`doc_reset` /
 * `follower_replaced`) invalidates the correlation the instant it is
 * received, active or not, but ordinary tab (de)activation never does — so
 * this owner takes no `isTargetActive` input at all, only "which lineage is
 * this" ({@link PendingCorrelation.adopt}/{@link PendingCorrelation.resetIfTracked})
 * and "what did the doc just prove" ({@link PendingCorrelation.onProjected}/
 * {@link PendingCorrelation.resolveIfAlreadyCurrent}).
 */
export interface PendingCorrelationDeps {
  /** The already-constructed tracker this correlation wraps (see the module doc above). */
  pendingOps: PendingOpTracker
  /** The doc seq last projected; also the tracker's `currentSeq` source. */
  getWatermark(): number | null
  setWatermark(seq: number | null): void
  /**
   * Runs the adapter's authoritative full reconcile against the follower doc
   * for `workflowId` — the same path the first frame after a (re)bind takes
   * — and returns whether it committed. Consulted by
   * {@link PendingCorrelation.resolveIfAlreadyCurrent} BEFORE it settles
   * parked entries: an already-current subscribe ack means no catch-up
   * `doc_update` is coming to drive that reconcile through `applyFrame`, so
   * nothing else will ever repair a `delete_node`/`connect` whose effect
   * silently never landed.
   */
  reconcileFromDoc(workflowId: string, seq: number): boolean
  /** Per-op-kind doc presence check; see `docEffectPresent` in the composable. */
  effectPresent(op: Op): boolean | null
}

/** The subscribe ack {@link PendingCorrelation.resolveIfAlreadyCurrent} classifies. */
interface ReactivationAck {
  workflowId: string | null
  seq: number | undefined
  generation: number | undefined
  isReactivation: boolean
}

export interface PendingCorrelation {
  readonly pendingOps: PendingOpTracker
  /** True while `next` names a different lineage than the one tracked now. */
  lineageChanged(next: string | null): boolean
  /** Adopts `next` as the tracked lineage, resetting the correlation first. */
  adopt(next: string | null): void
  /**
   * A lineage break (`doc_reset` / `follower_replaced`) for `workflowId`:
   * resets the correlation iff it names the lineage currently tracked.
   * `pendingOps.reset()` is safe whether or not this tab is active, so there
   * is nothing to defer to reactivation.
   */
  resetIfTracked(workflowId: unknown): void
  /**
   * Drops every parked entry and the projected-seq watermark together, and
   * cancels the already-current retry timer if one is outstanding — the
   * whole catch-up transition ends together, so a timer left running past a
   * lineage break or scope teardown could fire {@link retryAlreadyCurrent}
   * against a `pendingRetry` a later `adopt`/lineage has no relation to.
   */
  reset(): void
  /**
   * Watermark and settlement for an applied frame; the caller owns both the
   * reconcile and, per ADR-CRDT-RECONCILE-0035's fixed resolve/apply/clear
   * frame order, the earlier `resolveDeliveryUnknown` call against the
   * frame's `catchUp` flag — this only clears what THIS frame's effect or
   * seq coverage settles, after that resolution and the reconcile have run.
   */
  onProjected(update: { seq: number | null; opIds?: string[] }): void
  /**
   * The host sends no catch-up `doc_update` at all when this follower's
   * state vector was already current — the only sign a resubscribe completed
   * with nothing to apply. Without this, a parked entry from before the tab
   * went inactive would never see the catch-up barrier that resolves it, and
   * a `delete_node`/`connect` whose effect never landed would never get the
   * reconcile that could reveal it.
   *
   * `ack.generation` (when provided) is the bridge's outstanding-subscribe
   * generation for the ack: only its first successful ack is consumed as a
   * barrier, so a duplicate or delayed-retry ack for a generation already
   * consumed is a no-op here — sequence equality alone cannot tell a fresh
   * resubscribe from a stale repeat of one already acted on.
   *
   * `ack.isReactivation` scopes the continuity rule to an ack that follows a
   * resume from a paused (tab-inactive) subscription: `ack.seq` equal to
   * what this correlation last projected means the document did not change
   * while away (seq is monotonic across a same-workflow remint), so parked
   * entries survive and the reconcile above runs as it always has, revert-
   * on-absence included. A DIFFERENT `ack.seq` there is ordinary same-
   * lineage progress, not proof any parked effect is absent (this frontend
   * has no generation token yet — a named backend dependency — to rule out a
   * silent remint under the same workflow id, so it cannot go further than
   * that): `resume` still runs, and the guaranteed catch-up `doc_update` this
   * implies still runs the barrier's same per-kind check in
   * `applyAndReconcile`, but {@link consumeCatchUpRevertOnAbsent} flags that
   * ONE catch-up not to revert on absence — an absent entry stays parked as
   * `delivery_unknown` and resolves at the next same-lineage `doc_update`, an
   * explicit host rejection, or the retry-timeout expiry instead. Outside a
   * reactivation (the ordinary resubscribe-while-active case, e.g. a FEB-2
   * gap or a reconnect), a seq mismatch is left alone as before: the natural
   * catch-up frame resolves things through {@link onProjected} and
   * `applyAndReconcile`'s own (unflagged, revert-on-absence-as-usual)
   * per-kind rules.
   *
   * `resume` runs on every path through this method that reaches a decision
   * (a bare ack, a duplicate generation, continuity established, or
   * continuity unproven) — there is no case left where held ops must wait
   * further once this ack has been classified.
   */
  resolveIfAlreadyCurrent(ack: ReactivationAck, resume: () => void): void
  /**
   * Snapshots the current watermark as the immutable baseline
   * {@link resolveIfAlreadyCurrent} compares a REACTIVATION ack against.
   * Called exactly when a tab-away hold begins (before the resubscribe that
   * will eventually produce that ack), because nothing else in this module
   * observes a live doc frame between then and the ack — the hold's own
   * unsubscribe stops the bridge from forwarding one — so this is the last
   * moment the watermark is known to reflect what was projected before the
   * away period, rather than whatever a same-lineage frame that outran the
   * ack bumped it to since.
   */
  beginReactivation(): void
  /**
   * Re-attempts a forced reconcile that {@link resolveIfAlreadyCurrent}
   * deferred because {@link PendingCorrelationDeps.reconcileFromDoc}
   * returned false (a missing/busy session, or an uncommitted batch) — a
   * no-op otherwise. Called opportunistically on every applied frame and by
   * this module's own bounded, internally-owned retry timer (armed the
   * instant a NEW deferral happens — see {@link ALREADY_CURRENT_RETRY_INTERVAL_MS}/
   * {@link ALREADY_CURRENT_RETRY_MAX_ATTEMPTS} — and cancelled by
   * {@link reset}), so a parked entry is never stranded on a single failed
   * attempt. Returns true once nothing is left to retry (there was nothing
   * pending, or this call just resolved it), so the internal retry loop can
   * stop early instead of running out its budget.
   */
  retryAlreadyCurrent(): boolean
  /**
   * Whether the NEXT `update.catchUp` frame's `resolveDeliveryUnknown` call
   * (`applyAndReconcile` in the composable) may revert an entry the per-kind
   * check finds absent. Defaults to, and always resets back to, `true` once
   * read — {@link resolveIfAlreadyCurrent} flips it to `false` for exactly
   * the one guaranteed catch-up a reactivation ack with an unproven-
   * continuity seq mismatch implies, per ADR-CRDT-RECONCILE-0035 (a)'s
   * reactivation-continuity rule; every catch-up after that one reverts on
   * absence as usual, including one driven by a later, successful resubscribe
   * once the connection recovers (e.g. after CRDT-FOLLOWER-0035's bounded
   * ack-timeout retry).
   */
  consumeCatchUpRevertOnAbsent(): boolean
}

export function createPendingCorrelation(
  deps: PendingCorrelationDeps
): PendingCorrelation {
  const pendingOps = deps.pendingOps
  let lineageId: string | null = null
  // The last subscribe generation whose ack this correlation has already
  // consumed as a catch-up barrier; a later ack naming the SAME generation
  // is a duplicate/delayed-retry ack and must never act as a second one.
  let consumedGeneration: number | undefined
  // Set when `reconcileFromDoc` returns false, so `retryAlreadyCurrent` can
  // pick the same attempt back up instead of leaving the entry stranded.
  let pendingRetry: { workflowId: string; ackSeq: number } | null = null
  // The watermark at the instant a tab-away hold began, frozen for the
  // DURATION of that hold: `onProjected` can still advance the live
  // watermark before the resume's own ack arrives (a replacement-lineage
  // `doc_update` can reach this composable ahead of its `doc_subscribed`),
  // and comparing THAT reactivation ack against the live value would let
  // such a stray update forge an already-current match. `undefined` means no
  // hold is outstanding; only a reactivation ack ever reads it, and it is
  // cleared the instant one does.
  let reactivationBaseline: number | null | undefined
  // Consumed by `consumeCatchUpRevertOnAbsent`; see that method's doc
  // comment. Reset to `true` on every read, so it only ever suppresses the
  // ONE catch-up a continuity-unproven reactivation ack implies.
  let nextCatchUpRevertOnAbsent = true
  // The internally-owned already-current retry timer and its attempt count —
  // the whole catch-up transition's lifecycle (lineage, consumed generation,
  // pendingRetry, AND this timer) now lives under one owner; see `reset`'s
  // doc comment for why it must be cancelled there too.
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAttempts = 0

  function clearRetryTimer(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    retryAttempts = 0
  }

  function scheduleRetry(): void {
    clearRetryTimer()
    const attempt = (): void => {
      retryAttempts += 1
      const resolved = retryAlreadyCurrent()
      retryTimer =
        resolved || retryAttempts >= ALREADY_CURRENT_RETRY_MAX_ATTEMPTS
          ? null
          : setTimeout(attempt, ALREADY_CURRENT_RETRY_INTERVAL_MS)
    }
    retryTimer = setTimeout(attempt, ALREADY_CURRENT_RETRY_INTERVAL_MS)
  }

  function reset(): void {
    deps.setWatermark(null)
    pendingRetry = null
    reactivationBaseline = undefined
    nextCatchUpRevertOnAbsent = true
    clearRetryTimer()
    pendingOps.reset()
  }

  /** True once nothing is left to retry for this attempt. */
  function tryResolveAlreadyCurrent(
    workflowId: string | null,
    ackSeq: number
  ): boolean {
    if (workflowId !== null) {
      // No catch-up frame is coming to run the adapter's full reconcile, so
      // force it here — the same path the first frame after a (re)bind
      // takes — BEFORE resolving parked entries against the doc it
      // produces. Otherwise an unacknowledged delete_node/connect that never
      // landed resolves as `diverged` with nothing left to repair the
      // canvas.
      const committed = deps.reconcileFromDoc(workflowId, ackSeq)
      if (!committed) {
        const isNewDeferral = pendingRetry === null
        pendingRetry = { workflowId, ackSeq }
        if (isNewDeferral) scheduleRetry()
        return false
      }
    }
    pendingRetry = null
    pendingOps.resolveDeliveryUnknown(deps.effectPresent)
    return true
  }

  /** See {@link PendingCorrelation.retryAlreadyCurrent}. */
  function retryAlreadyCurrent(): boolean {
    if (!pendingRetry) return true
    const { workflowId, ackSeq } = pendingRetry
    return tryResolveAlreadyCurrent(workflowId, ackSeq)
  }

  return {
    pendingOps,
    lineageChanged(next) {
      return lineageId !== next
    },
    adopt(next) {
      reset()
      lineageId = next
    },
    resetIfTracked(workflowId) {
      if (typeof workflowId === 'string' && workflowId === lineageId) reset()
    },
    reset,
    onProjected(update) {
      deps.setWatermark(update.seq)
      if (update.opIds) pendingOps.onDocEffect(update.opIds)
      pendingOps.onAuthoritativeState(update.seq)
      retryAlreadyCurrent()
    },
    beginReactivation() {
      reactivationBaseline = deps.getWatermark()
    },
    resolveIfAlreadyCurrent(ack, resume) {
      const { workflowId, seq: ackSeq, generation, isReactivation } = ack
      if (ackSeq === undefined) {
        resume()
        return
      }
      if (generation !== undefined) {
        if (generation === consumedGeneration) {
          resume()
          return
        }
        consumedGeneration = generation
      }
      // A reactivation ack is checked against the baseline frozen at
      // `beginReactivation`, never the live watermark: see that method's and
      // `reactivationBaseline`'s doc comments for the pre-ack race this
      // guards against. Consumed once — a later, non-reactivation ack always
      // reads the live watermark.
      const watermark =
        isReactivation && reactivationBaseline !== undefined
          ? reactivationBaseline
          : deps.getWatermark()
      if (isReactivation) reactivationBaseline = undefined
      resume()
      if (ackSeq === watermark) {
        tryResolveAlreadyCurrent(workflowId, ackSeq)
        return
      }
      if (isReactivation) {
        // ADR-CRDT-RECONCILE-0035 (a), round-6 correction: a changed seq at
        // reactivation is ordinary same-lineage progress, not proof any
        // parked effect is absent — there is no destructive invalidation
        // here anymore. The seq gap guarantees a catch-up `doc_update` is
        // coming (see `layoutFollowerBridge.ts`'s `isCatchUp`); flag that ONE
        // frame's barrier not to revert on absence instead of forcing a
        // reconcile now.
        nextCatchUpRevertOnAbsent = false
      }
      // Non-reactivation mismatch, as before: left alone for the natural
      // catch-up frame to resolve through `onProjected`.
    },
    retryAlreadyCurrent,
    consumeCatchUpRevertOnAbsent() {
      const value = nextCatchUpRevertOnAbsent
      nextCatchUpRevertOnAbsent = true
      return value
    }
  }
}
