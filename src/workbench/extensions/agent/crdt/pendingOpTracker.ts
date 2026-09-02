/**
 * Pending-op tracker (s3-opt-6 dispatch wiring): the glue that drives the
 * pure {@link PendingOpLedger} and {@link PendingOpShadowSurface} from the
 * {@link OpSender}'s lifecycle hooks and the follower's authoritative frames.
 *
 * Every human op has exactly two ways to leave the pending surface:
 *
 * - EFFECT: its `doc_update` arrives carrying the op id (`DocUpdate.opIds`,
 *   DQ-9) and the shadow is cleared. An `applied` ack alone never clears a
 *   shadow (KEEP-ALIVE #9): the ack says the host accepted the op, the
 *   update says the doc now shows it.
 * - REVERT: the op will never take effect. The host rejected it (`failed`),
 *   never reached it (`unprocessed` after a failed prefix), no doc was bound
 *   or the transport never carried it (`undeliverable`), or one resend also
 *   drew silence (`unacknowledged`). The shadow is reverted and the entry
 *   dropped, so the optimistic styling disappears instead of lingering.
 *
 * `skipped` covers two host outcomes that share one property: the op will
 * never produce an effect frame of its own. Either the op id already existed
 * host-side (a re-delivery; a fully duplicate batch produces no broadcast at
 * all) or the applier dropped it under last-writer-wins, in which case its
 * effect is specifically NOT in the doc — a competing write is. What settles
 * a skipped entry is therefore not "its effect landed" but "the doc state at
 * or beyond the ack's `seq` is authoritative for whatever it touched", so
 * it must never be re-shown as the op's own optimistic value. It is still
 * never cleared on the ack itself (s3-opt-2): removal happens on an
 * authoritative PROJECTION transition. A skipped entry clears when the
 * follower has projected doc state at or beyond the ack's `seq` —
 * immediately at ack time when the projected seq already covers it,
 * otherwise on the first later projected `doc_update` whose seq covers it.
 * When the ack carries no seq, the next projected authoritative transition
 * of any seq clears it (the outcome pre-existed the ack, so any later
 * authoritative state reflects it). A `doc_update` that happens to carry the
 * id still clears it through the EFFECT path first.
 *
 * Nothing here touches the canvas; it only maintains the two data
 * structures and reports what it did so a renderer/dev-panel can react.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import type { BatchOutcome } from './opSender'
import type { PendingOpEntry, PendingOpLedger } from './pendingOpLedger'
import { createPendingOpLedger } from './pendingOpLedger'
import type { PendingOpShadowSurface, ShadowTarget } from './pendingOpShadow'
import { createPendingOpShadowSurface } from './pendingOpShadow'

type PendingOpRevertReason =
  | 'failed'
  | 'unprocessed'
  | 'unattributed'
  | 'unacknowledged'
  | 'undeliverable'

export type PendingOpTrackerEvent =
  | { type: 'reverted'; reason: PendingOpRevertReason; opIds: string[] }
  | { type: 'cleared'; opIds: string[] }
  /** Skipped duplicates resolved by a projection at/after their ack seq. */
  | { type: 'skipped_cleared'; seq: number | null; opIds: string[] }
  /** Skipped duplicates parked until a projection covers their ack seq. */
  | { type: 'skipped_awaiting'; seq: number | null; opIds: string[] }
  | { type: 'reset'; opIds: string[] }

export interface PendingOpTrackerDeps {
  ledger?: PendingOpLedger<Op>
  shadow?: PendingOpShadowSurface
  /**
   * The highest doc seq the follower has PROJECTED (applied to the canvas),
   * read at ack time to decide whether a skipped duplicate can resolve now.
   * Defaults to 0: never covers a numbered ack seq, so skipped entries wait
   * for {@link PendingOpTracker.onAuthoritativeState}.
   */
  currentSeq?(): number
  /** Observability tap; never throws back into the tracker. */
  onEvent?(event: PendingOpTrackerEvent): void
}

export interface PendingOpTracker {
  /** `OpSenderDeps.onBatchMinted`. */
  onBatchMinted(ops: Op[]): void
  /** `OpSenderDeps.onBatchTransmitted`. */
  onBatchTransmitted(ops: Op[]): void
  /** `OpSenderDeps.onBatchSettled`. */
  onBatchSettled(outcome: BatchOutcome): void
  /** A `doc_update` carried these op ids: their effect is now in the doc. */
  onDocEffect(opIds: readonly string[]): void
  /**
   * The follower projected authoritative doc state at `seq` (null when the
   * update carried no usable seq). Resolves every awaiting skipped duplicate
   * whose ack seq is covered — this, not the ack, is its removal trigger.
   * `DocUpdate.seq` is a required number, so the follower never passes null
   * today; the null contract is kept for callers whose transition has no
   * seq, where it can satisfy an unnumbered requirement but never a numbered
   * one.
   */
  onAuthoritativeState(seq: number | null): void
  /** Doc lineage broke (reset / replacement / teardown): nothing is pending. */
  reset(): void
  entries(): PendingOpEntry<Op>[]
  readonly shadow: PendingOpShadowSurface
}

/**
 * Which canvas entities an op paints while pending. Ids are stringified
 * because the wire allows numeric node ids while the shadow keys on strings.
 */
export function shadowTargetsFor(op: Op): ShadowTarget[] {
  switch (op.op) {
    case 'add_node':
      return [{ kind: 'node', nodeId: String(op.node_id) }]
    case 'delete_node':
      return [
        { kind: 'node', nodeId: String(op.node_id) },
        ...op.removed_links.map(
          (link): ShadowTarget => ({ kind: 'link', linkId: String(link) })
        )
      ]
    case 'connect':
      return [{ kind: 'link', linkId: String(op.link_id) }]
    case 'set_widget':
      return [
        { kind: 'widget', nodeId: String(op.node_id), widgetName: op.widget }
      ]
    case 'clear':
      return op.removed_nodes.map((nodeId) => ({
        kind: 'node',
        nodeId: String(nodeId)
      }))
  }
}

export function createPendingOpTracker(
  deps: PendingOpTrackerDeps = {}
): PendingOpTracker {
  const ledger = deps.ledger ?? createPendingOpLedger<Op>()
  const shadow = deps.shadow ?? createPendingOpShadowSurface()
  const currentSeq = deps.currentSeq ?? (() => 0)
  // Per-op send count, mirrored from the sender's transmit hook so a result
  // for an earlier attempt of a resent batch is rejected by the ledger.
  const attempts = new Map<string, number>()
  // Skipped op id → the ack seq the follower must project before it resolves
  // (null: the ack carried no seq; any later projection resolves it).
  const awaitingSkipped = new Map<string, number | null>()

  function emit(event: PendingOpTrackerEvent): void {
    deps.onEvent?.(event)
  }

  function drop(opId: string): PendingOpEntry<Op> | undefined {
    attempts.delete(opId)
    awaitingSkipped.delete(opId)
    return ledger.take(opId)
  }

  function revert(opIds: readonly string[], reason: PendingOpRevertReason) {
    const reverted: string[] = []
    for (const opId of opIds) {
      const entry = drop(opId)
      shadow.revert(opId)
      if (entry) reverted.push(opId)
    }
    if (reverted.length > 0) emit({ type: 'reverted', reason, opIds: reverted })
  }

  /**
   * `clear`, not `revert`: authoritative state already contains the
   * duplicate's outcome, so pending styling RESOLVES rather than rolls back.
   */
  function clearSkipped(opIds: readonly string[], seq: number | null) {
    const cleared: string[] = []
    for (const opId of opIds) {
      const entry = drop(opId)
      shadow.clear(opId)
      if (entry) cleared.push(opId)
    }
    if (cleared.length > 0)
      emit({ type: 'skipped_cleared', seq, opIds: cleared })
  }

  return {
    shadow,
    onBatchMinted(ops) {
      for (const op of ops) {
        if (ledger.enqueue(op.op_id, op)) {
          shadow.show(op.op_id, shadowTargetsFor(op))
        }
      }
    },
    onBatchTransmitted(ops) {
      const ids = ops.map((op) => op.op_id)
      ledger.markInFlight(ids)
      for (const id of ids) attempts.set(id, (attempts.get(id) ?? 0) + 1)
    },
    onBatchSettled(outcome) {
      const batch = outcome.ops.map((op) => op.op_id)
      if (outcome.state !== 'acknowledged') {
        revert(batch, outcome.state)
        return
      }
      const { result } = outcome
      const failedOpId = result.failure?.op_id ?? null
      const summary = ledger.reconcileOpsResult({
        batch,
        applied: result.applied,
        skipped: result.skipped,
        failedOpId,
        failure: result.failure,
        attempts: Object.fromEntries(
          batch.map((id) => [id, attempts.get(id) ?? 0])
        )
      })
      revert(summary.failed, 'failed')
      revert(summary.unprocessed, 'unprocessed')
      if (summary.skipped.length > 0) {
        const ackSeq = result.seq ?? null
        if (ackSeq !== null && currentSeq() >= ackSeq) {
          // The projection already folded doc state at/after the ack, so the
          // duplicate's authoritative outcome is on screen NOW. This is a
          // projection-based transition, not a clear-on-ack.
          clearSkipped(summary.skipped, ackSeq)
        } else {
          for (const opId of summary.skipped) awaitingSkipped.set(opId, ackSeq)
          emit({
            type: 'skipped_awaiting',
            seq: ackSeq,
            opIds: summary.skipped
          })
        }
      }
      if (result.ok) return
      // An anonymous `ok:false` (no lists, no failed op id) names nothing, so
      // the ledger leaves the batch in flight; nothing will ever clear it.
      const unattributed = batch.filter(
        (id) => ledger.get(id)?.state === 'inflight'
      )
      revert(unattributed, 'unattributed')
    },
    onDocEffect(opIds) {
      if (opIds.length === 0) return
      const cleared = ledger.clearOnEffect(opIds)
      for (const entry of cleared) {
        shadow.clear(entry.opId)
        attempts.delete(entry.opId)
        awaitingSkipped.delete(entry.opId)
      }
      if (cleared.length > 0)
        emit({ type: 'cleared', opIds: cleared.map((entry) => entry.opId) })
    },
    onAuthoritativeState(seq) {
      if (awaitingSkipped.size === 0) return
      const covered: string[] = []
      for (const [opId, requiredSeq] of awaitingSkipped) {
        // A null requirement (ack carried no seq) is satisfied by ANY later
        // authoritative transition; a null seq (update carried no usable seq)
        // still proves a transition happened, which is all a null requirement
        // needs — but cannot prove coverage of a numbered requirement.
        if (requiredSeq === null || (seq !== null && seq >= requiredSeq))
          covered.push(opId)
      }
      clearSkipped(covered, seq)
    },
    reset() {
      const dropped = ledger.reset()
      shadow.clearAll()
      attempts.clear()
      awaitingSkipped.clear()
      if (dropped.length > 0)
        emit({ type: 'reset', opIds: dropped.map((entry) => entry.opId) })
    },
    entries() {
      return ledger.entries()
    }
  }
}
