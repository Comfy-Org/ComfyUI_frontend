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
 * `skipped` (op id already present host-side) is treated like `applied`: an
 * effect already exists in the doc and its update clears the entry.
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
  | { type: 'reset'; opIds: string[] }

export interface PendingOpTrackerDeps {
  ledger?: PendingOpLedger<Op>
  shadow?: PendingOpShadowSurface
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
  // Per-op send count, mirrored from the sender's transmit hook so a result
  // for an earlier attempt of a resent batch is rejected by the ledger.
  const attempts = new Map<string, number>()

  function emit(event: PendingOpTrackerEvent): void {
    deps.onEvent?.(event)
  }

  function revert(opIds: readonly string[], reason: PendingOpRevertReason) {
    const reverted: string[] = []
    for (const opId of opIds) {
      const entry = ledger.take(opId)
      shadow.revert(opId)
      attempts.delete(opId)
      if (entry) reverted.push(opId)
    }
    if (reverted.length > 0) emit({ type: 'reverted', reason, opIds: reverted })
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
      }
      if (cleared.length > 0)
        emit({ type: 'cleared', opIds: cleared.map((entry) => entry.opId) })
    },
    reset() {
      const dropped = ledger.reset()
      shadow.clearAll()
      attempts.clear()
      if (dropped.length > 0)
        emit({ type: 'reset', opIds: dropped.map((entry) => entry.opId) })
    },
    entries() {
      return ledger.entries()
    }
  }
}
