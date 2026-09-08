import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

import type { BatchOutcome } from './opSender'
import type { PendingOpEntry, PendingOpLedger } from './pendingOpLedger'
import { createPendingOpLedger } from './pendingOpLedger'

type PendingOpRevertReason =
  | 'failed'
  | 'unprocessed'
  | 'unattributed'
  | 'undeliverable'

export type PendingOpTrackerEvent =
  | { type: 'reverted'; reason: PendingOpRevertReason; opIds: string[] }
  | { type: 'delivery_unknown'; opIds: string[] }
  | { type: 'cleared'; opIds: string[] }
  /** Skipped duplicates resolved by a projection at/after their ack seq. */
  | { type: 'skipped_cleared'; seq: number | null; opIds: string[] }
  /** Skipped duplicates parked until a projection covers their ack seq. */
  | { type: 'skipped_awaiting'; seq: number | null; opIds: string[] }
  | { type: 'reset'; opIds: string[] }

export interface PendingOpTrackerDeps {
  ledger?: PendingOpLedger<Op>
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
}

export function createPendingOpTracker(
  deps: PendingOpTrackerDeps = {}
): PendingOpTracker {
  const ledger = deps.ledger ?? createPendingOpLedger<Op>()
  const currentSeq = deps.currentSeq ?? (() => 0)
  // Per-op send count, mirrored from the sender's transmit hook so a result
  // for an earlier attempt of a resent batch is rejected by the ledger.
  const attempts = new Map<string, number>()
  // Skipped op id → the ack seq the follower must project before it resolves
  // (null: the ack carried no seq; any later projection resolves it).
  const awaitingSkipped = new Map<string, number | null>()

  function emit(event: PendingOpTrackerEvent): void {
    try {
      deps.onEvent?.(event)
    } catch (error) {
      reportError(error, {
        errorType: 'agent_crdt_pending_op_event_listener_failed'
      })
    }
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
      if (entry) cleared.push(opId)
    }
    if (cleared.length > 0)
      emit({ type: 'skipped_cleared', seq, opIds: cleared })
  }

  return {
    onBatchMinted(ops) {
      for (const op of ops) {
        ledger.enqueue(op.op_id, op)
      }
    },
    onBatchTransmitted(ops) {
      const ids = ops.map((op) => op.op_id)
      ledger.markInFlight(ids)
      for (const id of ids) attempts.set(id, (attempts.get(id) ?? 0) + 1)
    },
    onBatchSettled(outcome) {
      const batch = outcome.ops.map((op) => op.op_id)
      if (outcome.state === 'unacknowledged') {
        emit({ type: 'delivery_unknown', opIds: batch })
        return
      }
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
