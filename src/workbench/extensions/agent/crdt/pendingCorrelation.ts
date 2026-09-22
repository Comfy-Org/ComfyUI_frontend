import type { Op } from '@comfyorg/comfy-multi-player'

import type { PendingOpTracker, PendingOpTrackerDeps } from './pendingOpTracker'
import { createPendingOpTracker } from './pendingOpTracker'

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
  ledger?: PendingOpTrackerDeps['ledger']
  onEvent?: PendingOpTrackerDeps['onEvent']
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
  /** Watermark and settlement for an applied frame; the caller owns the reconcile. */
  onProjected(update: {
    seq: number | null
    opIds?: string[]
    catchUp?: boolean
  }): void
  /**
   * The host sends no catch-up `doc_update` at all when this follower's
   * state vector was already current — the only sign a resubscribe completed
   * with nothing to apply. Without this, a parked entry from before the tab
   * went inactive would never see the catch-up barrier that resolves it, and
   * a `delete_node`/`connect` whose effect never landed would never get the
   * reconcile that could reveal it.
   */
  resolveIfAlreadyCurrent(
    workflowId: string | null,
    ackSeq: number | undefined
  ): void
}

export function createPendingCorrelation(
  deps: PendingCorrelationDeps
): PendingCorrelation {
  let lineageId: string | null = null
  let lastProjectedSequence: number | null = null

  const pendingOps = createPendingOpTracker({
    ledger: deps.ledger,
    // Applied seq only, never the ack fallback: between doc_subscribed(seq=N)
    // and the catch-up doc_update(seq=N) the canvas still shows pre-subscribe
    // state, so a skipped result must park there rather than clear on the ack.
    currentSeq: () => lastProjectedSequence ?? 0,
    onEvent: deps.onEvent
  })

  function reset(): void {
    lastProjectedSequence = null
    pendingOps.reset()
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
      lastProjectedSequence = update.seq
      if (update.opIds) pendingOps.onDocEffect(update.opIds)
      pendingOps.onAuthoritativeState(update.seq)
      // The catch-up barrier only: this is the first frame of a same-lineage
      // rebind, so whatever the doc holds now is the best evidence available
      // for a parked entry. An unrelated live delta must not resolve one —
      // its absence there would prove nothing about a delivery that raced it.
      if (update.catchUp) pendingOps.resolveDeliveryUnknown(deps.effectPresent)
    },
    resolveIfAlreadyCurrent(workflowId, ackSeq) {
      if (ackSeq === undefined || ackSeq !== lastProjectedSequence) return
      // No catch-up frame is coming to run the adapter's full reconcile, so
      // force it here — the same path the first frame after a (re)bind takes
      // — BEFORE resolving parked entries against the doc it produces.
      // Otherwise an unacknowledged delete_node/connect that never landed
      // resolves as `diverged` with nothing left to repair the canvas.
      if (workflowId !== null) deps.reconcileFromDoc(workflowId, ackSeq)
      pendingOps.resolveDeliveryUnknown(deps.effectPresent)
    }
  }
}
