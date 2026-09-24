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
 * settlement pass that runs an "already current" `doc_subscribed` ack's
 * presence check against doc state. Split out of `useAgentCrdtFollower.ts`
 * so lineage adoption/invalidation and that settlement pass have one focused
 * home instead of synchronized branches spread across tracker state,
 * projection watermarks and activation handlers.
 *
 * Deliberately independent of tab activation: a lineage break (`doc_reset` /
 * `follower_replaced`) invalidates the correlation the instant it is
 * received, active or not, but ordinary tab (de)activation never does — so
 * this owner takes no `isTargetActive` input at all, only "which lineage is
 * this" ({@link PendingCorrelation.adopt}/{@link PendingCorrelation.resetIfTracked})
 * and "what did the doc just prove" ({@link PendingCorrelation.onProjected}/
 * {@link PendingCorrelation.resolveIfAlreadyCurrent}).
 *
 * Round 7/8: a `doc_subscribed` acknowledgement never settles a parked entry
 * by itself (the wire carries no echoed subscribe identity, so a duplicate
 * ack is undecidable from a fresh one — see `resolveIfAlreadyCurrent`'s doc
 * comment). What survives from every ack is (i) re-establishing the
 * subscription (`agentCrdtDocLifecycle.ts`'s retry timer, disarmed by the
 * composable's own `onSubscribeConfirmed` before this module is called), and
 * (ii) — only when no catch-up `doc_update` is coming at all
 * (`ackSeq === watermark`) — running the same presence-only resolution pass a
 * catch-up frame runs, since nothing else would ever repair a
 * `delete_node`/`connect` whose effect silently never landed. Nothing about
 * an ack's `seq` is recorded anywhere else; the pending ledger's bounded
 * terminal path (round 8) is an absolute per-entry deadline that doc seq and
 * acks play no part in.
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
   * is nothing to defer to reactivation. This is the "existing lineage-break
   * handling" the bounded ledger terminal path's condition (a) defers to —
   * every parked entry drops silently here, never through the standard
   * rejected-operation notification, since a lineage break means the doc
   * this ledger was tracking is gone, not that its ops were rejected.
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
   * The target-session/document destruction boundary
   * (ADR-CRDT-RECONCILE-0035 (a)'s ledger-ownership bullet, round 8): unlike
   * {@link reset}, every still-parked entry drops as `abandoned` first — no
   * revert, no rejection toast, since destruction is not a rejection — before
   * the same cleanup {@link reset} does.
   */
  destroy(): void
  /**
   * Watermark and settlement for an applied frame; the caller owns both the
   * reconcile and, per ADR-CRDT-RECONCILE-0035's fixed resolve/apply/clear
   * frame order, the earlier `resolveDeliveryUnknown` call against the
   * frame's `catchUp` flag — this only clears what THIS frame's effect or
   * seq coverage settles, after that resolution and the reconcile have run.
   */
  onProjected(update: { seq: number | null; opIds?: string[] }): void
  /**
   * Round 7/8: `doc_subscribed` carries only the workflow id, status and
   * `seq` — no echoed request or generation id — so a duplicate or
   * delayed-retry ack is indistinguishable from a fresh one purely from the
   * wire. No acknowledgement-based rule can safely use that to decide a
   * parked entry is resolved, so this method no longer tries to: only when
   * there is no catch-up `doc_update` coming at all (`ack.seq === watermark`,
   * the "already current" case) does it run the presence-only resolution
   * pass — which, like an ordinary catch-up frame's, only ever settles a
   * PRESENT entry and never reverts one it finds absent. Running that pass
   * again for a duplicate ack is a harmless no-op: presence checks and the
   * reconcile it forces are idempotent, and there is no barrier left to
   * protect from being crossed twice. Nothing about the ack's `seq` is
   * recorded anywhere else.
   *
   * `ack.isReactivation` scopes the WATERMARK COMPARISON to what
   * {@link beginReactivation} froze before a tab-away hold began, for an ack
   * that follows resuming from a paused (tab-inactive) subscription — see
   * that method's doc comment for the pre-ack race this guards against. It
   * no longer changes how absence is handled: absence never reverts through
   * this path or a catch-up frame's, reactivation or not.
   *
   * `resume` runs on every path through this method that reaches a decision
   * — there is no case left where held ops must wait further once this ack
   * has been read.
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
}

export function createPendingCorrelation(
  deps: PendingCorrelationDeps
): PendingCorrelation {
  const pendingOps = deps.pendingOps
  let lineageId: string | null = null
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
  // The internally-owned already-current retry timer and its attempt count —
  // the whole catch-up transition's lifecycle (lineage, pendingRetry, AND
  // this timer) now lives under one owner; see `reset`'s doc comment for why
  // it must be cancelled there too.
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

  function clearOwnState(): void {
    deps.setWatermark(null)
    pendingRetry = null
    reactivationBaseline = undefined
    clearRetryTimer()
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
      // landed has nothing left to repair the canvas until the bounded
      // ledger terminal path notifies (round 8: it never reverts either).
      const committed = deps.reconcileFromDoc(workflowId, ackSeq)
      if (!committed) {
        const isNewDeferral = pendingRetry === null
        pendingRetry = { workflowId, ackSeq }
        if (isNewDeferral) scheduleRetry()
        return false
      }
    }
    pendingRetry = null
    // This ack settles nothing by itself — only a PRESENT entry settles
    // here, exactly like an ordinary catch-up frame.
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
      clearOwnState()
      pendingOps.reset()
      lineageId = next
    },
    resetIfTracked(workflowId) {
      if (typeof workflowId === 'string' && workflowId === lineageId) {
        clearOwnState()
        pendingOps.reset()
      }
    },
    reset() {
      clearOwnState()
      pendingOps.reset()
    },
    destroy() {
      clearOwnState()
      pendingOps.destroy()
    },
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
      const { workflowId, seq: ackSeq, isReactivation } = ack
      if (ackSeq === undefined) {
        resume()
        return
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
      if (ackSeq === watermark) tryResolveAlreadyCurrent(workflowId, ackSeq)
      // A seq mismatch, reactivation or not, is left alone: the natural
      // catch-up frame resolves things through `onProjected` and
      // `applyAndReconcile`'s own presence check, which never reverts on
      // absence either (round 7).
    },
    retryAlreadyCurrent
  }
}
