import type { Op } from '@comfyorg/comfy-multi-player'

import type { PendingOpTracker } from './pendingOpTracker'

/**
 * The doc seq {@link PendingCorrelation} has last projected, shared with the
 * pending-op tracker's `currentSeq` dependency. Lifted out to a standalone
 * box, constructed before either side, so the tracker and the correlation
 * that wraps it can each read/write the same watermark without either one
 * needing a forward reference to the other (the nullable
 * `projectionRef.current` cycle this replaces — see
 * `useAgentCrdtFollower.ts`'s construction order).
 */
export interface ProjectedSequenceWatermark {
  get(): number | null
  set(seq: number | null): void
}

export function createProjectedSequenceWatermark(): ProjectedSequenceWatermark {
  let seq: number | null = null
  return {
    get: () => seq,
    set(value) {
      seq = value
    }
  }
}

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
  /** The watermark this correlation reads/writes; also the tracker's `currentSeq` source. */
  watermark: ProjectedSequenceWatermark
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
  /**
   * Settles every batch the sender still holds — queued/open ones
   * `undeliverable` (revert, with the existing toast), a transmitted-but-
   * unacknowledged one `unconfirmed` (parked, per (a)'s parked set). Called
   * by {@link PendingCorrelation.resolveIfAlreadyCurrent} when a reactivation
   * ack cannot establish continuity with what this correlation last
   * projected: this frontend has no generation token yet (a backend
   * dependency, not decided here) to prove the resumed subscription is the
   * same lineage the ledger was built against, so it conservatively treats
   * every batch as addressed to a doc it can no longer vouch for.
   */
  abortSender(): void
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
  /** Drops every parked entry and the projected-seq watermark together. */
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
   * `generation` (when provided) is the bridge's outstanding-subscribe
   * generation for the ack that produced this call: only its first
   * successful ack is consumed as a barrier, so a duplicate or delayed-retry
   * ack for a generation already consumed is a no-op here — sequence
   * equality alone cannot tell a fresh resubscribe from a stale repeat of
   * one already acted on.
   *
   * `isReactivation` scopes the continuity rule to an ack that follows a
   * resume from a paused (tab-inactive) subscription: `ackSeq` equal to what
   * this correlation last projected means the document did not change while
   * away (seq is monotonic across a same-workflow remint), so parked entries
   * survive and the reconcile above runs as it always has. A DIFFERENT
   * `ackSeq` there cannot be trusted to mean "a catch-up frame is coming and
   * will resolve things normally" — a `doc_reset` missed while inactive
   * remints the same workflow id with no lineage-break notice, and this
   * frontend has no generation token yet to tell that apart from ordinary
   * progress — so it conservatively invalidates instead (`deps.abortSender`
   * plus reverting whatever was already parked). Outside a reactivation
   * (the ordinary resubscribe-while-active case, e.g. a FEB-2 gap or a
   * reconnect), a seq mismatch is left alone: the follower's state vector
   * was never stale, so the natural catch-up frame is trusted to arrive and
   * resolve things through {@link onProjected} instead.
   */
  resolveIfAlreadyCurrent(
    workflowId: string | null,
    ackSeq: number | undefined,
    generation: number | undefined,
    isReactivation: boolean
  ): void
  /**
   * Re-attempts a forced reconcile that {@link resolveIfAlreadyCurrent}
   * deferred because {@link PendingCorrelationDeps.reconcileFromDoc}
   * returned false (a missing/busy session, or an uncommitted batch) — a
   * no-op otherwise. Called opportunistically on every applied frame and on
   * every retry pass, so a parked entry is never stranded on a single failed
   * attempt.
   */
  retryAlreadyCurrent(): void
}

export function createPendingCorrelation(
  deps: PendingCorrelationDeps
): PendingCorrelation {
  const pendingOps = deps.pendingOps
  const watermark = deps.watermark
  let lineageId: string | null = null
  // The last subscribe generation whose ack this correlation has already
  // consumed as a catch-up barrier; a later ack naming the SAME generation
  // is a duplicate/delayed-retry ack and must never act as a second one.
  let consumedGeneration: number | undefined
  // Set when `reconcileFromDoc` returns false, so `retryAlreadyCurrent` can
  // pick the same attempt back up instead of leaving the entry stranded.
  let pendingRetry: { workflowId: string; ackSeq: number } | null = null

  function reset(): void {
    watermark.set(null)
    pendingRetry = null
    pendingOps.reset()
  }

  function tryResolveAlreadyCurrent(
    workflowId: string | null,
    ackSeq: number
  ): void {
    if (workflowId !== null) {
      // No catch-up frame is coming to run the adapter's full reconcile, so
      // force it here — the same path the first frame after a (re)bind
      // takes — BEFORE resolving parked entries against the doc it
      // produces. Otherwise an unacknowledged delete_node/connect that never
      // landed resolves as `diverged` with nothing left to repair the
      // canvas.
      const committed = deps.reconcileFromDoc(workflowId, ackSeq)
      if (!committed) {
        pendingRetry = { workflowId, ackSeq }
        return
      }
    }
    pendingRetry = null
    pendingOps.resolveDeliveryUnknown(deps.effectPresent)
  }

  function invalidateStaleReactivation(): void {
    // Whatever is already parked belongs to a lineage this ack cannot vouch
    // for continuity with (ADR-CRDT-RECONCILE-0035 (a)'s missing-generation-
    // token gap): treat every one of those entries as though its effect is
    // absent, reverting it with the existing toast, rather than let it be
    // retained through the rebind's full reconcile (whose ledger-derived
    // `LocalIntent.pendingAdds`/`pendingConnects` would otherwise protect
    // stale, possibly wrong-lineage ids).
    pendingOps.resolveDeliveryUnknown(() => false)
    // A batch the sender still holds is settled the same way, never
    // re-addressed to a doc this ack cannot vouch for: queued/open ones
    // revert `undeliverable` now; a transmitted-but-unacknowledged one parks
    // `unconfirmed` and is left there, resolved only by the strict per-kind
    // rules at whatever catch-up frame actually arrives.
    deps.abortSender()
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
      watermark.set(update.seq)
      if (update.opIds) pendingOps.onDocEffect(update.opIds)
      pendingOps.onAuthoritativeState(update.seq)
      this.retryAlreadyCurrent()
    },
    resolveIfAlreadyCurrent(workflowId, ackSeq, generation, isReactivation) {
      if (ackSeq === undefined) return
      if (generation !== undefined) {
        if (generation === consumedGeneration) return
        consumedGeneration = generation
      }
      if (ackSeq === watermark.get()) {
        tryResolveAlreadyCurrent(workflowId, ackSeq)
        return
      }
      if (isReactivation) invalidateStaleReactivation()
    },
    retryAlreadyCurrent() {
      if (!pendingRetry) return
      const { workflowId, ackSeq } = pendingRetry
      tryResolveAlreadyCurrent(workflowId, ackSeq)
    }
  }
}
