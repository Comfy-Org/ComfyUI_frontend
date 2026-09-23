/**
 * The human write leg's sender (plan 3.2/3.3): takes semantic
 * {@link GraphOperation}s from the mint ports, mints wire identity ONCE, and
 * drives `doc_ops` frames through the doc frame client with bounded retries
 * that never re-mint an `op_id` (changed-payload reuse rejects host-side;
 * an unchanged resend converges through the applier's idempotency gate).
 *
 * Batches are strictly serialized: one in-flight batch at a time, FIFO, so
 * op order on the wire matches mint order. `base_version` is read at mint
 * time from the follower's last observed sequence.
 *
 * Outcome handling is deliberately the TODAY contract: `doc_ops_result` is a
 * binary applied/skipped split. The prefix-abort reconcile and per-op
 * outcome-union surfacing (lww-dropped, op_rejected, ...) land when the host
 * frame upgrade ships (a required backend dependency, recorded on the plan);
 * `onResult` is the seam they will replace.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

import type { GraphOperation } from './graphOperations'
import { chunkWireOps, mintWireOps } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

export interface OpsResultView {
  workflowId?: string
  ok: boolean
  applied: string[]
  skipped: string[]
  /** Failed-batch diagnostics when the host provides them; `op_id` correlates an otherwise empty-list failure to its batch. */
  failure?: { op_id?: string }
}

export interface OpSenderDeps {
  /** `DocFrameClient.sendOps` shape: false = the transport cannot carry it now. */
  sendOps(workflowId: string, tab: string, ops: Op[]): boolean
  /** Subscribe to `doc_ops_result` frames; returns unsubscribe. */
  onOpsResult(listener: (result: OpsResultView) => void): () => void
  /**
   * The bound workflow id, or null when no doc is bound. Read at mint time to
   * address the batch and re-read before EVERY send and resend: a batch whose
   * workflow is no longer bound (subscription refused, tab moved to another
   * doc) is never carried or re-addressed and settles at once, 'unconfirmed'
   * if the transport already carried it and 'undeliverable' otherwise.
   */
  workflowId(): string | null
  tab: string
  /** `human:<user>:<tab>` (vocabulary §7). */
  actor(): string
  /** The follower's last observed doc sequence (stamps `base_version`). */
  baseVersion(): number
  /**
   * Opaque per-op admission-time metadata, read once when `op`'s `op_id` is
   * minted and handed back on that op's own {@link BatchOutcome}, keyed by
   * that same `op_id`. The sender neither inspects `op` to decide whether to
   * call this nor interprets what comes back - which ops carry metadata and
   * what it means (e.g. a `delete_node`'s target Yjs item identity) is the
   * caller's own domain policy, kept out of transport batching and retry.
   * Omitted deps default to capturing nothing. `undefined` and `null` are
   * both valid, distinct results: `undefined` means this op carries no
   * metadata at all (omitted from {@link BatchOutcome.admissionMetadata}),
   * while `null` is itself a captured value (e.g. identity capture was
   * attempted but inconclusive) and is present in the map like any other.
   */
  admissionMetadata?(op: Op): string | null | undefined
  /**
   * Terminal per-batch report: 'acknowledged' carries the host's result;
   * 'unacknowledged' means one resend after silence also drew no result;
   * 'unconfirmed' means the transport carried it at least once but its doc
   * was unbound before any result arrived, so the host may or may not have
   * applied it; 'undeliverable' means the transport never carried it within
   * the retry budget or no doc was bound.
   */
  onBatchSettled(outcome: BatchOutcome): void
}

// A discriminated union, not `{ workflowId: string | null } & (state union)`:
// only an immediate, never-bound `admit()` (no doc to address the batch to)
// can settle without a workflow id, and only as 'undeliverable'. Every other
// state settles a batch that was minted against a real `InFlight.workflowId`
// (a `string`), so making `workflowId: null` uncombinable with them here
// means a caller cannot construct an invalid pairing and have it compile.
export type BatchOutcome = (
  | {
      workflowId: string
      state: 'acknowledged'
      ops: Op[]
      result: OpsResultView
    }
  | { workflowId: string; state: 'unacknowledged'; ops: Op[] }
  | { workflowId: string; state: 'unconfirmed'; ops: Op[] }
  | { workflowId: string | null; state: 'undeliverable'; ops: Op[] }
) & {
  /** Every op in this batch, by its own `op_id` -> the metadata captured for it at admission time (see {@link OpSenderDeps.admissionMetadata}). */
  admissionMetadata: ReadonlyMap<string, string | null>
}

export interface OpSender {
  enqueue(operations: GraphOperation[]): void
  /**
   * Mint and target-pin operations into the open admission group without
   * starting transport delivery. Consecutive admissions for one workflow
   * share the group until `flush()` seals it.
   */
  admit(operations: GraphOperation[]): void
  /** Seal the open admission group into wire batches and start delivery. */
  flush(): void
  /** In-flight + queued batch count (observability; 0 = drained). */
  pending(): number
  /** Every unsettled batch, in-flight first, each addressed to its mint-time workflow. */
  pendingOps(): ReadonlyArray<{ workflowId: string; ops: Op[] }>
  /**
   * The bound workflow's tab went inactive: the subscription is paused, not
   * lost. Until `resume()`, a batch reaching `transmit()` is parked instead
   * of sent or settled, so it neither reaches an unsubscribed doc nor dies
   * `undeliverable`. A batch already sent keeps its result timer, so a late
   * result still settles it. Idempotent.
   */
  suspend(): void
  /**
   * Re-transmit the parked batch, if any. The transmit-time binding check
   * still runs, so a batch whose workflow is no longer bound settles
   * `undeliverable` exactly as it would have. Idempotent.
   */
  resume(): void
  /**
   * Eager abort seam (FE #16637 residual): settle the in-flight batch NOW
   * ('unconfirmed' once transmitted, 'undeliverable' otherwise) if its
   * mint-time workflow no longer matches `deps.workflowId()`, instead of
   * waiting out the 10 s result-silence window before the next transmit
   * re-reads it. A caller with an earlier
   * signal that the subscription is gone (e.g. `doc_subscribed {ok:false}`)
   * should call this immediately; a no-op otherwise (still bound, or the
   * unbind already resolved through the normal transmit-time check).
   *
   * Not for reconnect: `resubscribe()` re-binds the SAME id synchronously on
   * a live socket, so this stays a no-op there by design — the batch rides
   * the result timer to its idempotent resend, which is the right outcome
   * (the ops may well have landed), not `undeliverable`.
   */
  abortIfUnbound(): void
  /**
   * Lineage-break seam: settle the in-flight batch ('unconfirmed' once
   * transmitted, 'undeliverable' otherwise) and every queued batch
   * `undeliverable` NOW, in mint order, although the doc is still bound. A
   * `doc_reset` replaced the document these ops were minted against; the
   * human-authored draft that caused it already carries their effect, so
   * re-addressing them to the new lineage would apply them twice.
   */
  abortAll(): void
  /**
   * Tears the sender down for good: settles every outstanding batch exactly
   * as {@link abortAll} does (the in-flight one 'unconfirmed' once
   * transmitted, 'undeliverable' otherwise; every queued and open batch
   * 'undeliverable'), then stops sending. A caller that unmounts mid-batch
   * - the CRDT follower's own `onScopeDispose` - must not lose track of a
   * human-authored op silently: an unreported drop here is indistinguishable
   * from success to `onBatchSettled`'s listener, and a delete the host never
   * received can resurrect its node on the next reconcile. A listener that
   * throws settling one batch never blocks the rest, and the transport
   * always unsubscribes. Terminal: an `admit()`/`enqueue()` that arrives
   * after `detach()` settles `undeliverable` at once instead of joining a
   * group `pump()` would then refuse to ever drain.
   */
  detach(): void
}

interface InFlight extends OpGroup {
  opIds: Set<string>
  transmitted: boolean
  resent: boolean
  parked: boolean
  timer: ReturnType<typeof setTimeout> | null
}

interface OpGroup {
  workflowId: string
  ops: Op[]
  /** Captured once at admission time (see {@link captureAdmissionMetadata}) and carried by reference as the group moves from `open` to `queue` to {@link InFlight} - never a separate, manually-synced side table. */
  admissionMetadata: Map<string, string | null>
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: OpGroup[] = []
  let open: OpGroup | null = null
  let inFlight: InFlight | null = null
  let detached = false
  let suspended = false

  /**
   * `deps.admissionMetadata` for every op just minted, keyed by its own
   * `op_id`; empty when the dep is omitted. An op whose capture returns
   * `undefined` carries no metadata and is left out of the map entirely,
   * distinct from a captured `null`.
   */
  function captureAdmissionMetadata(ops: Op[]): Map<string, string | null> {
    const metadata = new Map<string, string | null>()
    if (!deps.admissionMetadata) return metadata
    for (const op of ops) {
      const captured = deps.admissionMetadata(op)
      if (captured !== undefined) metadata.set(op.op_id, captured)
    }
    return metadata
  }
  // Late-result credits: a batch retired after transmission (settled
  // 'unacknowledged' after two sends, or 'unconfirmed' by an abort after one
  // or two) may still draw one result per send - as ANONYMOUS failures
  // (empty id lists, no failure op_id) they are indistinguishable from the
  // current batch's. Swallowing up to the credit beats mis-attribution: a
  // swallowed own-result only costs the idempotent resend cycle, while a
  // mis-attributed settle poisons everything downstream of this seam.
  let staleAnonymousBudget = 0

  function reportDetachSettleFailure(cause: unknown): void {
    reportError(cause, {
      errorType: 'agent_op_sender_detach_settle_failed',
      tags: { feature_area: 'agent', operation: 'sync', outcome: 'degraded' }
    })
  }

  function settle(outcome: BatchOutcome): void {
    if (inFlight?.timer) clearTimeout(inFlight.timer)
    inFlight = null
    deps.onBatchSettled(outcome)
    pump()
  }

  function transmit(batch: InFlight, attempt: number): void {
    if (detached || inFlight !== batch) return
    if (suspended) {
      batch.parked = true
      return
    }
    // A lost subscription is not a transport that recovers in 500 ms: settle
    // now rather than spend the retry budget while later batches wait behind.
    if (deps.workflowId() !== batch.workflowId) {
      settleUnbound(batch)
      return
    }
    if (!deps.sendOps(batch.workflowId, deps.tab, batch.ops)) {
      if (attempt < SEND_RETRY_LIMIT) {
        // Tracked in the same slot as the result timer (they never overlap:
        // the result timer is armed only after a successful send) so
        // settle()/detach() clear a pending retry too.
        batch.timer = setTimeout(
          () => transmit(batch, attempt + 1),
          SEND_RETRY_INTERVAL_MS
        )
      } else {
        settleUnbound(batch)
      }
      return
    }
    batch.transmitted = true
    armResultTimeout(batch)
  }

  function settleUnbound(batch: InFlight): void {
    if (inFlight !== batch) return
    if (batch.transmitted) staleAnonymousBudget += batch.resent ? 2 : 1
    settle({
      state: batch.transmitted ? 'unconfirmed' : 'undeliverable',
      ops: batch.ops,
      workflowId: batch.workflowId,
      admissionMetadata: batch.admissionMetadata
    })
  }

  function armResultTimeout(batch: InFlight): void {
    if (inFlight !== batch) return
    batch.timer = setTimeout(() => {
      if (inFlight !== batch) return
      if (batch.resent) {
        staleAnonymousBudget += 2
        settle({
          state: 'unacknowledged',
          ops: batch.ops,
          workflowId: batch.workflowId,
          admissionMetadata: batch.admissionMetadata
        })
        return
      }
      // One silent-result resend of the SAME minted ops: idempotent at the
      // applier through the op_id gate.
      batch.resent = true
      transmit(batch, 0)
    }, RESULT_TIMEOUT_MS)
  }

  /**
   * Drains the in-flight batch, the queue, then the open group, and reports
   * each through `notify`, which owns only whether a settlement failure is
   * caught: {@link abortAll} lets one propagate, {@link detach} reports and
   * continues to the next.
   */
  function drainOutstanding(notify: (outcome: BatchOutcome) => void): void {
    const queued = queue.splice(0)
    const admitted = open
    open = null
    if (inFlight) {
      const batch = inFlight
      if (batch.timer) clearTimeout(batch.timer)
      if (batch.transmitted) staleAnonymousBudget += batch.resent ? 2 : 1
      inFlight = null
      notify({
        state: batch.transmitted ? 'unconfirmed' : 'undeliverable',
        ops: batch.ops,
        workflowId: batch.workflowId,
        admissionMetadata: batch.admissionMetadata
      })
    }
    for (const batch of queued) {
      notify({
        state: 'undeliverable',
        ops: batch.ops,
        workflowId: batch.workflowId,
        admissionMetadata: batch.admissionMetadata
      })
    }
    if (admitted) {
      notify({
        state: 'undeliverable',
        ops: admitted.ops,
        workflowId: admitted.workflowId,
        admissionMetadata: admitted.admissionMetadata
      })
    }
  }

  function pump(): void {
    if (detached || inFlight !== null) return
    const queued = queue.shift()
    if (!queued) return
    inFlight = {
      workflowId: queued.workflowId,
      ops: queued.ops,
      admissionMetadata: queued.admissionMetadata,
      opIds: new Set(queued.ops.map((op) => op.op_id)),
      transmitted: false,
      resent: false,
      parked: false,
      timer: null
    }
    transmit(inFlight, 0)
  }

  function settleUnadmitted(minted: Op[], workflowId: string | null): void {
    deps.onBatchSettled({
      state: 'undeliverable',
      ops: minted,
      workflowId,
      admissionMetadata: captureAdmissionMetadata(minted)
    })
  }

  function admit(operations: GraphOperation[]): void {
    if (operations.length === 0) return
    const minted = mintWireOps(operations, {
      actor: deps.actor(),
      baseVersion: deps.baseVersion()
    })
    const workflowId = deps.workflowId()
    // Detached is terminal: nothing will ever flush or transmit again, so an
    // admission that arrives after detach (a re-entrant admit from a settle
    // listener, or a lingering caller) must settle immediately rather than
    // join a group `flush()` would move into `queue` for a `pump()` that
    // permanently refuses to send it. Unbound (no doc to join a group for)
    // settles the same way.
    if (detached || workflowId === null) {
      settleUnadmitted(minted, workflowId)
      return
    }
    const admissionMetadata = captureAdmissionMetadata(minted)
    if (open?.workflowId !== workflowId) seal()
    if (open) {
      open.ops.push(...minted)
      for (const [opId, metadata] of admissionMetadata)
        open.admissionMetadata.set(opId, metadata)
    } else {
      open = { workflowId, ops: minted, admissionMetadata }
    }
  }

  function seal(): void {
    if (!open) return
    const { workflowId, ops, admissionMetadata } = open
    open = null
    for (const chunkOps of chunkWireOps(ops)) {
      const chunkOpIds = new Set(chunkOps.map((op) => op.op_id))
      queue.push({
        workflowId,
        ops: chunkOps,
        admissionMetadata: new Map(
          [...admissionMetadata].filter(([opId]) => chunkOpIds.has(opId))
        )
      })
    }
  }

  function flush(): void {
    seal()
    pump()
  }

  /**
   * Whether `result` must be drained as a stale credit instead of settling
   * the in-flight batch: it names ops that are not in flight (a retired
   * batch's own result), or it is anonymous (empty lists, no failure
   * `op_id`) while a credit from an earlier retirement is still outstanding
   * - either way indistinguishable from this batch's own result otherwise.
   */
  function namesRetiredBatch(result: OpsResultView, batch: InFlight): boolean {
    const identified = [...result.applied, ...result.skipped]
    if (result.failure?.op_id) identified.push(result.failure.op_id)
    if (identified.length > 0) {
      return !identified.some((opId) => batch.opIds.has(opId))
    }
    return staleAnonymousBudget > 0
  }

  const unsubscribe = deps.onOpsResult((result) => {
    if (
      !inFlight ||
      (result.workflowId !== undefined &&
        result.workflowId !== inFlight.workflowId)
    ) {
      // A late result with no batch waiting, or addressed to another workflow
      // than the in-flight batch: drain a credit if one is outstanding so it
      // cannot swallow a future batch's own result.
      if (staleAnonymousBudget > 0) staleAnonymousBudget--
      return
    }
    if (namesRetiredBatch(result, inFlight)) {
      if (staleAnonymousBudget > 0) staleAnonymousBudget--
      return
    }
    settle({
      state: 'acknowledged',
      ops: inFlight.ops,
      result,
      workflowId: inFlight.workflowId,
      admissionMetadata: inFlight.admissionMetadata
    })
  })

  return {
    enqueue(operations) {
      seal()
      admit(operations)
      flush()
    },
    admit,
    flush,
    pending() {
      return queue.length + (inFlight ? 1 : 0) + (open ? 1 : 0)
    },
    pendingOps() {
      const groups = [
        ...(inFlight ? [inFlight] : []),
        ...queue,
        ...(open ? [open] : [])
      ]
      return groups.map(({ workflowId, ops }) => ({ workflowId, ops }))
    },
    suspend() {
      suspended = true
    },
    resume() {
      suspended = false
      if (inFlight?.parked) {
        inFlight.parked = false
        transmit(inFlight, 0)
      }
    },
    abortIfUnbound() {
      if (inFlight && deps.workflowId() !== inFlight.workflowId) {
        settleUnbound(inFlight)
      }
    },
    abortAll() {
      drainOutstanding((outcome) => deps.onBatchSettled(outcome))
    },
    detach() {
      detached = true
      try {
        // A listener throwing on one batch must not swallow the rest -
        // each is its own report - or skip `unsubscribe()` below: a
        // listener's bug is not licence to leave a dead listener attached.
        drainOutstanding((outcome) => {
          try {
            deps.onBatchSettled(outcome)
          } catch (cause) {
            reportDetachSettleFailure(cause)
          }
        })
      } finally {
        unsubscribe()
      }
    }
  }
}
