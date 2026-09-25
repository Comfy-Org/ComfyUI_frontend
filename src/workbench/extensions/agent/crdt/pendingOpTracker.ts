import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

import type { BatchOutcome, OpsResultView } from './opSender'
import type { PendingOpEntry, PendingOpLedger } from './pendingOpLedger'
import { createPendingOpLedger } from './pendingOpLedger'

/**
 * ADR-CRDT-RECONCILE-0035 (a), round 8 (DrJKL, review 5298630064): the
 * bounded ledger terminal path is NON-DESTRUCTIVE. Each parked entry carries
 * an ABSOLUTE deadline of this length from the moment it parked — no
 * same-lineage frame extends it, and nothing about doc seq or acks feeds it.
 * On expiry the entry becomes `unresolved` (the optimistic projection stays
 * on the canvas; nothing reverts) and this tracker emits a distinct,
 * non-rejection notification — "could not confirm this edit synced" —
 * rather than the standard rejected-operation toast. The entry's identity
 * stays registered so a late echo or explicit host response can still
 * resolve it to `applied` or reverted, until a lineage break or destruction.
 * On the order of the existing `SUBSCRIBE_ACK_TIMEOUT_MS` bound
 * (`agentCrdtDocLifecycle.ts`) — the ingest relay's own resync budget.
 */
export const LEDGER_SETTLE_TIMEOUT_MS = 15_000

type PendingOpRevertReason =
  | 'failed'
  | 'unprocessed'
  | 'unattributed'
  | 'undeliverable'

export type PendingOpTrackerEvent =
  | {
      type: 'reverted'
      reason: PendingOpRevertReason
      opIds: string[]
      /** The dropped ops needed to undo their optimistic effects. */
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
  /** Duplicate already covered by a projected authoritative sequence. */
  | { type: 'skipped_cleared'; seq: number | null; opIds: string[] }
  /** Duplicate waiting for its acknowledged sequence to be projected. */
  | { type: 'skipped_awaiting'; seq: number | null; opIds: string[] }
  | { type: 'reset'; opIds: string[] }
  /**
   * The bounded ledger terminal path's deadline elapsed
   * (ADR-CRDT-RECONCILE-0035 (a), round 8): non-destructive — the entry is
   * still held as `unresolved`, only notified once so the user knows this
   * edit's sync status is unconfirmed.
   */
  | { type: 'unresolved'; opIds: string[] }
  /**
   * Destruction (target-session/document destroy) settled these still-parked
   * entries: dropped, deadlines cancelled, no revert and no rejection toast
   * — distinct from a lineage-break `reset`, which this is not.
   */
  | { type: 'abandoned'; opIds: string[] }

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
  onBatchMinted(ops: Op[]): void
  onBatchTransmitted(ops: Op[]): void
  onBatchSettled(outcome: BatchOutcome): void
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
   * Resolves every parked or `unresolved` entry against same-lineage doc
   * state. `effectPresent` answers, per op,
   * whether ITS success condition is visible now (`add_node`: node id
   * present and the doc node's type matches; `delete_node`: id ABSENT —
   * absence is the effect being checked for; `connect`: link id present;
   * `set_widget`: the target widget's current value equals the op's value),
   * or `null` when the kind cannot be checked this way (`clear`, which is
   * never parked, and any op kind this build has no projection for yet).
   * `true` clears the entry as applied.
   *
   * ADR-CRDT-RECONCILE-0035 (a), round 8 (DrJKL, review 5298630064): absence
   * never reverts, for any kind, ever — only when absence itself IS the
   * kind's success condition (`delete_node`) does it settle. `false` or
   * `null` from `effectPresent` always leaves the entry parked; the only
   * paths that ever settle it are presence, an explicit host response, a
   * lineage break, or destruction. The bounded ledger terminal path
   * ({@link LEDGER_SETTLE_TIMEOUT_MS}) changes its status to `unresolved` but
   * does not revert or discard it.
   */
  resolveDeliveryUnknown(effectPresent: (op: Op) => boolean | null): void
  reset(): void
  /**
   * The target-session/document destruction boundary (ADR-CRDT-RECONCILE-0035
   * (a)'s ledger-ownership bullet, round 8): every parked (`delivery_unknown`)
   * or `unresolved` entry is dropped as `abandoned` — no revert or rejection
   * toast, since
   * destruction is not a rejection — and every settle deadline is cancelled.
   * Every other entry drops silently, exactly as {@link reset} does — a
   * queued/in-flight/applied op has no unresolved "was it lost?" question the
   * way a parked one does.
   */
  destroy(): void
  entries(): PendingOpEntry<Op>[]
  /**
   * The `class_type` of a pending `add_node` for this node id, read through
   * an id→opId index rather than a scan/clone of every entry (perf: O(1)
   * lookup instead of `entries().some(...)`). Returns `undefined` unless the
   * entry is in a state the host can have already reflected back to this
   * follower — `inflight`, `applied`, `delivery_unknown`, or `unresolved`; a
   * `queued` or `unprocessed` add_node was never sent (or was rejected before
   * send), so an incoming doc add under the same id cannot be its echo.
   */
  pendingAddType(nodeId: string): string | undefined
  /**
   * Every node id with an `add_node` this tracker still holds, in ANY state
   * (`queued` through `unresolved`) — unlike {@link pendingAddType},
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
  /**
   * Every node id with a `delete_node` this tracker still holds, in ANY
   * state — including `applied` (KEEP-ALIVE #9: the host accepted it, but
   * the ledger keeps the entry until its own `doc_update` effect, the node's
   * disappearance, proves it landed). This is the single source for
   * `LocalIntent.pendingDeletes`: a full doc reconcile must not resurrect a
   * node whose delete the host has accepted, or the human queued, just
   * because the doc has not caught up yet.
   */
  pendingDeleteNodeIds(): ReadonlySet<string>
}

/**
 * What {@link PendingOpTracker.resolveDeliveryUnknown} does with one parked
 * entry. Round 8: there is no `'revert'` disposition — absence never settles
 * an entry from this path, so the only outcomes are "its success condition
 * is visible" or "still unknown".
 */
type DeliveryUnknownDisposition = 'clear' | 'skip'

function classifyDeliveryUnknownEntry(
  entry: PendingOpEntry<Op>,
  effectPresent: (op: Op) => boolean | null
): DeliveryUnknownDisposition {
  // ADR-CRDT-RECONCILE-0035 (a): `set_widget` is checked like any other kind
  // — the caller compares the target widget's current value against the
  // op's value, never an unconditional clear (last-writer-wins does not make
  // an arbitrary document value proof that THIS op landed). `delete_node`'s
  // success condition is the id's ABSENCE, already encoded as `true` by the
  // caller's `effectPresent` for that kind.
  return effectPresent(entry.shadow) === true ? 'clear' : 'skip'
}

/** States in which the host can have already reflected an op back to this follower. */
const ECHO_VISIBLE_STATES: ReadonlySet<PendingOpEntry<Op>['state']> = new Set([
  'inflight',
  'applied',
  'delivery_unknown',
  'unresolved'
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
  // delete_node node id → its pending op ids; backs `pendingDeleteNodeIds`.
  const deleteNodeIndex = new Map<string, Set<string>>()
  // Rejected op ids already reported this session, so a retried settle of
  // the same ledger entry (e.g. a duplicate `revert`) reports it only once.
  const reportedHumanOpFailures = new Set<string>()
  // Bounded ledger terminal path (ADR-CRDT-RECONCILE-0035 (a), round 8): one
  // outstanding, ABSOLUTE settle-deadline timer per parked op id, armed once
  // at park time and never restarted or otherwise fed by doc seq or acks.
  const deadlines = new Map<string, ReturnType<typeof setTimeout>>()

  function clearDeadline(opId: string): void {
    const timer = deadlines.get(opId)
    if (timer === undefined) return
    clearTimeout(timer)
    deadlines.delete(opId)
  }

  function clearAllDeadlines(): void {
    for (const timer of deadlines.values()) clearTimeout(timer)
    deadlines.clear()
  }

  /**
   * Terminal-path expiry for one parked entry (ADR-CRDT-RECONCILE-0035 (a),
   * round 8): non-destructive. The entry becomes `unresolved` while remaining
   * indexed and reconcilable by a late result or same-lineage frame. A
   * lineage break or destruction dropping the entry first (which cancels
   * this timer) is the only way this callback becomes a no-op.
   */
  function onDeadlineExpired(opId: string): void {
    deadlines.delete(opId)
    const entry = ledger.get(opId)
    if (!entry || entry.state !== 'delivery_unknown') return
    ledger.markUnresolved([opId])
    emit({ type: 'unresolved', opIds: [opId] })
  }

  function armDeadline(opId: string): void {
    clearDeadline(opId)
    deadlines.set(
      opId,
      setTimeout(() => onDeadlineExpired(opId), LEDGER_SETTLE_TIMEOUT_MS)
    )
  }

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
    } else if (entry.shadow.op === 'delete_node') {
      indexRemove(deleteNodeIndex, String(entry.shadow.node_id), entry.opId)
    }
  }

  function drop(opId: string): PendingOpEntry<Op> | undefined {
    attempts.delete(opId)
    awaitingSkipped.delete(opId)
    clearDeadline(opId)
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
      // An ack alone is insufficient; the projected sequence proves coverage.
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

  /** Shared by `onDocEffect` and presence-confirmed retained entries. */
  function applyEffect(opIds: readonly string[]): void {
    if (opIds.length === 0) return
    const cleared = ledger.clearOnEffect(opIds)
    for (const entry of cleared) {
      attempts.delete(entry.opId)
      awaitingSkipped.delete(entry.opId)
      clearDeadline(entry.opId)
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
        if (op.op === 'delete_node')
          indexAdd(deleteNodeIndex, String(op.node_id), op.op_id)
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
        for (const opId of parked) armDeadline(opId)
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
      const parked = [
        ...ledger.entries('delivery_unknown'),
        ...ledger.entries('unresolved')
      ]
      if (parked.length === 0) return
      const toClear: string[] = []
      for (const entry of parked) {
        if (classifyDeliveryUnknownEntry(entry, effectPresent) === 'clear')
          toClear.push(entry.opId)
      }
      // Nothing else happens to an entry this pass leaves retained: no
      // revert, and an outstanding terminal-path deadline is neither read
      // nor restarted here.
      applyEffect(toClear)
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
      clearAllDeadlines()
      const dropped = ledger.reset()
      attempts.clear()
      awaitingSkipped.clear()
      addNodeIndex.clear()
      connectLinkIndex.clear()
      deleteNodeIndex.clear()
      if (dropped.length > 0)
        emit({ type: 'reset', opIds: dropped.map((entry) => entry.opId) })
    },
    destroy() {
      // Round 8: destruction is not a rejection. Every still-parked entry is
      // dropped as `abandoned` — no revert, no rejection toast — since no
      // later frame can ever arrive to settle it (ADR-CRDT-RECONCILE-0035
      // (a)).
      const parkedIds = [
        ...ledger.entries('delivery_unknown'),
        ...ledger.entries('unresolved')
      ].map((entry) => entry.opId)
      for (const opId of parkedIds) drop(opId)
      if (parkedIds.length > 0) emit({ type: 'abandoned', opIds: parkedIds })
      // Whatever remains has no such unresolved question; drop it exactly as
      // an ordinary lineage-break reset does.
      clearAllDeadlines()
      const dropped = ledger.reset()
      attempts.clear()
      awaitingSkipped.clear()
      addNodeIndex.clear()
      connectLinkIndex.clear()
      deleteNodeIndex.clear()
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
    },
    pendingDeleteNodeIds() {
      return new Set(deleteNodeIndex.keys())
    }
  }
}
