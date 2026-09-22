import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

import type { BatchOutcome, OpsResultView } from './opSender'
import type { PendingOpEntry, PendingOpLedger } from './pendingOpLedger'
import { createPendingOpLedger } from './pendingOpLedger'

type PendingOpRevertReason =
  | 'failed'
  | 'unprocessed'
  | 'unattributed'
  | 'unconfirmed'
  | 'undeliverable'
  /**
   * A `delivery_unknown` entry's per-kind effect check found no trace of it
   * in the doc at the next same-lineage catch-up (ADR-CRDT-RECONCILE-0035).
   */
  | 'diverged'

export type PendingOpTrackerEvent =
  | {
      type: 'reverted'
      reason: PendingOpRevertReason
      opIds: string[]
      /** The dropped ledger entries' ops, so consumers can undo their effect. */
      ops: Op[]
      /**
       * The dropped entries' shadow ops carry their own kind (`ops` above),
       * so a consumer can already tell which of them were `add_node` — the
       * only kind whose canvas effect a revert can actually undo. There is
       * deliberately no `undone`-style boolean here: a batch can mix kinds
       * (e.g. an unprocessed `add_node` alongside a `connect`), and only a
       * consumer's own removal result (`pendingOpRevert.ts`'s
       * `removedNodeIds`) can prove an add was actually undone, not this
       * event alone. A type-level flag here could never enforce that
       * pairing, so the fact stays where it can be proven.
       */
    }
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
  /**
   * Resolves every `delivery_unknown` (parked) entry against the doc state a
   * same-lineage catch-up just projected. `effectPresent` answers, per op,
   * whether ITS effect is visible now (`add_node`: node id present;
   * `delete_node`: absent; `connect`: link id present), or `null` when the
   * kind cannot be checked this way (`set_widget`, which always resolves
   * present — LWW makes a value comparison meaningless — and `clear`, which
   * is never parked). Present clears the entry; absent reverts it
   * (`reason: 'diverged'`) through the same path a host rejection uses.
   */
  resolveDeliveryUnknown(effectPresent: (op: Op) => boolean | null): void
  /** Doc lineage broke (reset / replacement / teardown): nothing is pending. */
  reset(): void
  entries(): PendingOpEntry<Op>[]
  /**
   * The `class_type` of a pending `add_node` for this node id, read through
   * an id→opId index rather than a scan/clone of every entry (perf: O(1)
   * lookup instead of `entries().some(...)`). Returns `undefined` unless the
   * entry is in a state the host can have already reflected back to this
   * follower — `inflight`, `applied`, or `delivery_unknown`; a `queued` or
   * `unprocessed` add_node was never sent (or was rejected before send), so
   * an incoming doc add under the same id cannot be its echo.
   */
  pendingAddType(nodeId: string): string | undefined
  /**
   * Every node id with an `add_node` this tracker still holds, in ANY state
   * (`queued` through `delivery_unknown`) — unlike {@link pendingAddType},
   * which only answers for the echo-visible subset. A full doc reconcile
   * (`EcsFollowerAdapter`'s `LocalIntent.pendingAdds`) must not delete a live
   * node whose add is merely queued or in flight — it was never given the
   * chance to reach the doc yet, so its absence there proves nothing.
   */
  pendingAddNodeIds(): ReadonlySet<string>
  /**
   * Every link id with a `connect` this tracker still holds, in ANY state —
   * the `connect` sibling of {@link pendingAddNodeIds}. A full doc reconcile
   * (`EcsFollowerAdapter`'s `LocalIntent.pendingConnects`) must not drop a
   * live edge whose `connect` is merely queued or in flight — the doc not
   * holding the link yet proves nothing about it.
   */
  pendingConnectLinkIds(): ReadonlySet<string>
}

/** States in which the host can have already reflected an op back to this follower. */
const ECHO_VISIBLE_STATES: ReadonlySet<PendingOpEntry<Op>['state']> = new Set([
  'inflight',
  'applied',
  'delivery_unknown'
])

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
  // add_node node id → every op id still pending for it (usually one, but a
  // second add_node for the same node id must not evict an older pending
  // one), maintained alongside the ledger so `pendingAddType` is an index
  // lookup rather than a scan of every entry.
  const addNodeIndex = new Map<string, Set<string>>()
  // connect link id → its pending op ids; the `connect` sibling of
  // `addNodeIndex`, backing `pendingConnectLinkIds`.
  const connectLinkIndex = new Map<string, Set<string>>()
  // Rejected op ids already reported this session, so a retried settle of
  // the same ledger entry (e.g. a duplicate `revert`) reports it only once.
  const reportedHumanOpFailures = new Set<string>()

  function emit(event: PendingOpTrackerEvent): void {
    try {
      deps.onEvent?.(event)
    } catch (error) {
      reportError(error, {
        errorType: 'agent_crdt_pending_op_event_listener_failed'
      })
    }
  }

  function indexAdd(
    index: Map<string, Set<string>>,
    key: string,
    opId: string
  ): void {
    const opIds = index.get(key)
    if (opIds) opIds.add(opId)
    else index.set(key, new Set([opId]))
  }

  function indexRemove(
    index: Map<string, Set<string>>,
    key: string,
    opId: string
  ): void {
    const opIds = index.get(key)
    if (!opIds) return
    opIds.delete(opId)
    if (opIds.size === 0) index.delete(key)
  }

  function releaseIndexes(entry: PendingOpEntry<Op>): void {
    if (entry.shadow.op === 'add_node') {
      indexRemove(addNodeIndex, String(entry.shadow.node_id), entry.opId)
    } else if (entry.shadow.op === 'connect') {
      indexRemove(connectLinkIndex, String(entry.shadow.link_id), entry.opId)
    }
  }

  function drop(opId: string): PendingOpEntry<Op> | undefined {
    attempts.delete(opId)
    awaitingSkipped.delete(opId)
    const entry = ledger.take(opId)
    if (entry) releaseIndexes(entry)
    return entry
  }

  function revert(
    opIds: readonly string[],
    reason: PendingOpRevertReason
  ): PendingOpEntry<Op>[] {
    const reverted: PendingOpEntry<Op>[] = []
    for (const opId of opIds) {
      const entry = drop(opId)
      if (entry) reverted.push(entry)
    }
    if (reverted.length > 0)
      emit({
        type: 'reverted',
        reason,
        opIds: reverted.map((entry) => entry.opId),
        ops: reverted.map((entry) => entry.shadow)
      })
    return reverted
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

  function parkOrClearSkipped(skipped: string[], ackSeq: number | null): void {
    if (skipped.length === 0) return
    if (ackSeq !== null && currentSeq() >= ackSeq) {
      // The projection already folded doc state at/after the ack, so the
      // duplicate's authoritative outcome is on screen NOW. This is a
      // projection-based transition, not a clear-on-ack.
      clearSkipped(skipped, ackSeq)
      return
    }
    for (const opId of skipped) awaitingSkipped.set(opId, ackSeq)
    emit({ type: 'skipped_awaiting', seq: ackSeq, opIds: skipped })
  }

  function reconcileAcknowledged(batch: string[], result: OpsResultView): void {
    const summary = ledger.reconcileOpsResult({
      batch,
      applied: result.applied,
      skipped: result.skipped,
      failedOpId: result.failure?.op_id ?? null,
      failure: result.failure,
      attempts: Object.fromEntries(
        batch.map((id) => [id, attempts.get(id) ?? 0])
      )
    })
    for (const entry of revert(summary.failed, 'failed'))
      reportHumanOpRejected(entry)
    revert(summary.unprocessed, 'unprocessed')
    parkOrClearSkipped(summary.skipped, result.seq ?? null)
    if (result.ok) return
    // An anonymous `ok:false` (no lists, no failed op id) names nothing, so
    // the ledger leaves the batch in flight; nothing will ever clear it.
    // ADR-CRDT-RECONCILE-0035 (a): every host rejection is reported, and an
    // anonymous one is still a rejection at the BATCH level, so it reaches
    // `reportHumanOpRejected` too, with the synthetic `unattributed` code
    // standing in for the op-level `failure.code` this outcome never had.
    const unattributed = batch.filter(
      (id) => ledger.get(id)?.state === 'inflight'
    )
    for (const entry of revert(unattributed, 'unattributed'))
      reportHumanOpRejected(entry, 'unattributed')
  }

  /** Shared by `onDocEffect` and a resolved `delivery_unknown` entry. */
  function applyEffect(opIds: readonly string[]): void {
    if (opIds.length === 0) return
    const cleared = ledger.clearOnEffect(opIds)
    for (const entry of cleared) {
      attempts.delete(entry.opId)
      awaitingSkipped.delete(entry.opId)
      releaseIndexes(entry)
    }
    if (cleared.length > 0)
      emit({ type: 'cleared', opIds: cleared.map((entry) => entry.opId) })
  }

  function failureCode(failure: unknown): string | undefined {
    if (typeof failure !== 'object' || failure === null) return undefined
    if (!('code' in failure)) return undefined
    return typeof failure.code === 'string' ? failure.code : undefined
  }

  function reportHumanOpRejected(
    entry: PendingOpEntry<Op>,
    fallbackCode?: string
  ): void {
    if (reportedHumanOpFailures.has(entry.opId)) return
    reportedHumanOpFailures.add(entry.opId)
    const op = entry.shadow
    const code = failureCode(entry.failure) ?? fallbackCode
    reportError(new Error('Agent host rejected a human operation'), {
      errorType: 'agent_crdt_human_op_rejected',
      context: {
        opId: entry.opId,
        opKind: op.op,
        nodeId: 'node_id' in op ? String(op.node_id) : undefined,
        failureCode: code
      }
    })
  }

  return {
    onBatchMinted(ops) {
      for (const op of ops) {
        if (!ledger.enqueue(op.op_id, op)) continue
        if (op.op === 'add_node')
          indexAdd(addNodeIndex, String(op.node_id), op.op_id)
        if (op.op === 'connect')
          indexAdd(connectLinkIndex, String(op.link_id), op.op_id)
      }
    },
    onBatchTransmitted(ops) {
      const ids = ops.map((op) => op.op_id)
      ledger.markInFlight(ids)
      for (const id of ids) attempts.set(id, (attempts.get(id) ?? 0) + 1)
    },
    onBatchSettled(outcome) {
      const batch = outcome.ops.map((op) => op.op_id)
      // ADR-CRDT-RECONCILE-0035 (a): `unconfirmed` joins `unacknowledged` in
      // the parked set. Both mean the host may already have applied the
      // batch — `unacknowledged` because a resend also drew silence,
      // `unconfirmed` because the transport carried it once but the doc was
      // unbound before any result arrived — so both park rather than revert.
      if (
        outcome.state === 'unacknowledged' ||
        outcome.state === 'unconfirmed'
      ) {
        // A doc_update effect may already have retired part of the batch;
        // only what the ledger still tracks is genuinely delivery-unknown.
        const stillPending = batch.filter((opId) => ledger.get(opId))
        if (stillPending.length === 0) return
        // A `clear` is never parked: its delivery stays unknown, but nothing
        // here can verify it later (no per-node/link effect to check), so it
        // is left exactly as #16309 left it — inflight, unresolved.
        const parkable = outcome.ops
          .filter((op) => op.op !== 'clear' && stillPending.includes(op.op_id))
          .map((op) => op.op_id)
        const rejected =
          parkable.length > 0 ? ledger.markDeliveryUnknown(parkable) : parkable
        const parked = parkable.filter((opId) => !rejected.includes(opId))
        if (parked.length > 0) emit({ type: 'delivery_unknown', opIds: parked })
        // A rejected id was never `inflight` when parking was attempted (e.g.
        // still `queued`, its transmit never landed): it will never get a
        // delivery-unknown resolution, so it must settle here instead of
        // leaking as pending forever.
        revert(rejected, 'undeliverable')
        return
      }
      if (outcome.state !== 'acknowledged') {
        revert(batch, outcome.state)
        return
      }
      reconcileAcknowledged(batch, outcome.result)
    },
    onDocEffect(opIds) {
      applyEffect(opIds)
    },
    resolveDeliveryUnknown(effectPresent) {
      const parked = ledger.entries('delivery_unknown')
      if (parked.length === 0) return
      const toClear: string[] = []
      const toRevert: string[] = []
      for (const entry of parked) {
        const op = entry.shadow
        // `set_widget` has no meaningful presence check (LWW), so a parked
        // one always resolves present once a catch-up runs at all.
        const present = op.op === 'set_widget' ? true : effectPresent(op)
        if (present === null) continue
        if (present) toClear.push(entry.opId)
        else toRevert.push(entry.opId)
      }
      applyEffect(toClear)
      if (toRevert.length > 0) revert(toRevert, 'diverged')
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
      addNodeIndex.clear()
      connectLinkIndex.clear()
      if (dropped.length > 0)
        emit({ type: 'reset', opIds: dropped.map((entry) => entry.opId) })
    },
    entries() {
      return ledger.entries()
    },
    pendingAddType(nodeId) {
      const opIds = addNodeIndex.get(nodeId)
      if (!opIds) return undefined
      for (const opId of opIds) {
        const entry = ledger.get(opId)
        if (
          entry &&
          entry.shadow.op === 'add_node' &&
          ECHO_VISIBLE_STATES.has(entry.state)
        )
          return entry.shadow.class_type
      }
      return undefined
    },
    pendingAddNodeIds() {
      return new Set(addNodeIndex.keys())
    },
    pendingConnectLinkIds() {
      return new Set(connectLinkIndex.keys())
    }
  }
}
