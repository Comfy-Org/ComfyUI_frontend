/**
 * Human-op dispatcher (s3-opt-6 / CRDT-RM-3): the integration seam between
 * locally minted semantic ops and the transport. It is the ONLY place that
 * composes the pending-op ledger (s3-opt-1) with the presentation shadow
 * surface (s3-opt-5), and it owns the one policy neither pure module was
 * allowed to encode: what happens when a send returns false.
 *
 * Contract boundaries this module deliberately encodes:
 *
 * - Enqueue-before-send: an op is registered in the ledger and its shadow
 *   shown BEFORE the transport is attempted, so a send that fails (closed
 *   socket, no live subscription) can never silently drop a human's intent —
 *   the op is already visible as pending.
 * - Immutable identity: op ids are minted once by the caller and never
 *   regenerated here. A retry resends the IDENTICAL op objects, so the
 *   host's duplicate detection (skipped[]) stays sound across reconnects.
 * - Batch order is identity: the host processes a batch in submitted order
 *   and reports `failed.index` against it, so this module never reorders,
 *   splits, or merges a batch. While earlier batches are still unsent, a new
 *   dispatch queues BEHIND them instead of jumping the line, and a retry pass
 *   stops at the first batch that still cannot fly. `sentBatches()` preserves
 *   the as-sent order for the s3-opt-2 reconciler to map applied prefix /
 *   failed / skipped / unprocessed suffix.
 * - Bounded disposition: a batch whose send keeps failing is retried at most
 *   `maxSendAttempts` times, then REVERTED — shadows removed with the failure
 *   verb and ledger entries taken. No pending entry is immortal.
 * - No IO, no timers, no Yjs: the transport is an injected `send` function
 *   returning the boolean the bridge propagates, and retry passes are
 *   explicit calls driven by the composable's transport-recovery signals.
 */
import type { PendingOpLedger } from './pendingOpLedger'
import type { PendingOpShadowSurface, ShadowTarget } from './pendingOpShadow'

/** Structural minimum for a dispatchable op: the caller-minted immutable id. */
export interface DispatchableOp {
  readonly op_id: string
}

/** One batch handed to `send`, preserved verbatim for retry and mapping. */
export interface SentBatch {
  /** Op ids in submitted order — the order `failed.index` is counted in. */
  readonly opIds: readonly string[]
}

export interface UnsentBatch {
  readonly opIds: readonly string[]
  /** Send attempts consumed so far (0 = queued behind an earlier batch). */
  readonly attempts: number
}

export type DispatchResult =
  /** Batch enqueued and shadowed; `sent` is whether it left immediately. */
  | { readonly accepted: true; readonly sent: boolean }
  /** Nothing was enqueued, shown, or sent. */
  | {
      readonly accepted: false
      readonly reason: 'empty-batch' | 'duplicate-op-id'
      /** The offending ids (duplicates in-batch or already held). */
      readonly opIds: readonly string[]
    }

/** What one retry pass did, as flat op-id lists in batch order. */
export interface RetrySummary {
  /** Ops whose batch left the transport this pass (now in flight). */
  readonly resent: string[]
  /** Ops whose batch exhausted its attempts and was reverted. */
  readonly reverted: string[]
  /** Ops still held for a later pass. */
  readonly unsent: string[]
}

export interface HumanOpDispatcher<TOp extends DispatchableOp> {
  /**
   * Register, shadow, and (when no earlier batch is waiting) send one batch.
   * Rejects the WHOLE batch on any duplicate op id — a partial enqueue would
   * break the batch-order identity the reconciler depends on.
   */
  dispatch(
    ops: readonly TOp[],
    targetsByOpId?: ReadonlyMap<string, readonly ShadowTarget[]>
  ): DispatchResult
  /**
   * Re-attempt unsent batches in FIFO order with their IDENTICAL ops. Stops
   * at the first batch that still cannot fly (the transport is evidently
   * down; burning later batches' attempts would both waste the bound and
   * reorder sends). A batch that reaches `maxSendAttempts` failures is
   * reverted: shadows removed, ledger entries taken.
   */
  retryUnsent(): RetrySummary
  /** As-sent batches in send order, for s3-opt-2 result mapping. */
  sentBatches(): readonly SentBatch[]
  /** Batches still waiting for a successful send, in dispatch order. */
  unsentBatches(): readonly UnsentBatch[]
  /**
   * Drop everything (doc_reset / unmount, FEB-5): batch records, ledger
   * entries, shadows. Returns the op ids that were dropped.
   */
  reset(): string[]
}

interface BatchRecord<TOp> {
  readonly ops: readonly TOp[]
  readonly opIds: readonly string[]
  attempts: number
}

export function createHumanOpDispatcher<TOp extends DispatchableOp>(deps: {
  ledger: PendingOpLedger<TOp>
  shadow: PendingOpShadowSurface
  /** The bridge's send-boolean seam. Must never throw. */
  send: (ops: readonly TOp[]) => boolean
  /** Total send attempts per batch before revert. Default 3. */
  maxSendAttempts?: number
}): HumanOpDispatcher<TOp> {
  const { ledger, shadow, send } = deps
  const maxSendAttempts = deps.maxSendAttempts ?? 3
  const sent: BatchRecord<TOp>[] = []
  const unsent: BatchRecord<TOp>[] = []

  const markSent = (batch: BatchRecord<TOp>): void => {
    ledger.markInFlight(batch.opIds)
    sent.push(batch)
  }

  const revert = (batch: BatchRecord<TOp>): void => {
    for (const opId of batch.opIds) {
      shadow.revert(opId)
      ledger.take(opId)
    }
  }

  return {
    dispatch(ops, targetsByOpId) {
      if (ops.length === 0)
        return { accepted: false, reason: 'empty-batch', opIds: [] }
      const seen = new Set<string>()
      const duplicates: string[] = []
      for (const op of ops) {
        if (seen.has(op.op_id) || ledger.get(op.op_id) !== undefined)
          duplicates.push(op.op_id)
        seen.add(op.op_id)
      }
      if (duplicates.length > 0)
        return { accepted: false, reason: 'duplicate-op-id', opIds: duplicates }

      const batch: BatchRecord<TOp> = {
        ops: [...ops],
        opIds: ops.map((op) => op.op_id),
        attempts: 0
      }
      // Enqueue + shadow BEFORE the send, so a false return leaves the ops
      // visibly pending instead of silently dropped.
      for (const op of ops) {
        ledger.enqueue(op.op_id, op)
        shadow.show(op.op_id, targetsByOpId?.get(op.op_id) ?? [])
      }
      // An earlier batch is still waiting: sending now would reorder. Queue
      // behind it; the next retry pass drives both in FIFO order.
      if (unsent.length > 0) {
        unsent.push(batch)
        return { accepted: true, sent: false }
      }
      batch.attempts = 1
      if (send(batch.ops)) {
        markSent(batch)
        return { accepted: true, sent: true }
      }
      unsent.push(batch)
      return { accepted: true, sent: false }
    },

    retryUnsent() {
      const summary: RetrySummary = { resent: [], reverted: [], unsent: [] }
      while (unsent.length > 0) {
        const batch = unsent[0]
        batch.attempts += 1
        if (send(batch.ops)) {
          unsent.shift()
          markSent(batch)
          summary.resent.push(...batch.opIds)
          continue
        }
        if (batch.attempts >= maxSendAttempts) {
          unsent.shift()
          revert(batch)
          summary.reverted.push(...batch.opIds)
          continue
        }
        // Transport still down: stop here rather than burn the remaining
        // batches' attempts (and their FIFO order) on a socket that just
        // refused a frame.
        break
      }
      for (const batch of unsent) summary.unsent.push(...batch.opIds)
      return summary
    },

    sentBatches() {
      return sent.map((batch) => ({ opIds: batch.opIds }))
    },

    unsentBatches() {
      return unsent.map((batch) => ({
        opIds: batch.opIds,
        attempts: batch.attempts
      }))
    },

    reset() {
      const dropped = ledger.entries().map((entry) => entry.opId)
      for (const opId of dropped) ledger.take(opId)
      shadow.clearAll()
      sent.length = 0
      unsent.length = 0
      return dropped
    }
  }
}
