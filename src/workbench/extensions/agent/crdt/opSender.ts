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

import type { DocOpsResult } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import { chunkWireOps, mintWireOps } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

/**
 * The sender's view of a parsed `doc_ops_result`. Derived from the
 * authoritative {@link DocOpsResult} rather than restated, so the fields the
 * sender consumes retain their canonical names and types. `workflowId` is
 * optional only because a sender may be driven without one.
 */
export type OpsResultView = Pick<
  DocOpsResult,
  'ok' | 'applied' | 'skipped' | 'code' | 'failed'
> &
  Partial<Pick<DocOpsResult, 'workflowId'>>

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
   * Terminal per-batch report: 'acknowledged' carries the host's result;
   * 'unacknowledged' means one resend after silence also drew no result;
   * 'unconfirmed' means the transport carried it at least once but its doc
   * was unbound before any result arrived, so the host may or may not have
   * applied it; 'undeliverable' means the transport never carried it within
   * the retry budget or no doc was bound.
   */
  onBatchSettled(outcome: BatchOutcome): void
}

export type BatchOutcome =
  | { state: 'acknowledged'; ops: Op[]; result: OpsResultView }
  | { state: 'unacknowledged'; ops: Op[] }
  | { state: 'unconfirmed'; ops: Op[] }
  | { state: 'undeliverable'; ops: Op[] }

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
  /** Unsettled batch count for observability; 0 = drained. */
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
  /** Settle outstanding work, unsubscribe, and permanently stop this sender. */
  detach(): void
}

interface InFlight {
  workflowId: string
  ops: Op[]
  opIds: Set<string>
  sends: number
  reportedThrow: boolean
  resent: boolean
  parked: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: Array<{ workflowId: string; ops: Op[] }> = []
  let open: { workflowId: string; ops: Op[] } | null = null
  let inFlight: InFlight | null = null
  let lastMintedVersion = -1
  let lastMintedWorkflowId: string | null = null
  let detached = false
  let suspended = false
  // Late-result credits: every send a batch leaves the client with may still
  // draw a result, including the send whose silence provoked the resend and
  // the sends of a batch that has already settled. As ANONYMOUS failures
  // (empty id lists, no failure op_id) those are indistinguishable from the
  // current batch's, so one is swallowed per credit rather than risk a
  // mis-attributed settle, which poisons everything downstream of this seam.
  // The cost is not one cycle: a credit reserved for a result that never
  // arrives is never drained, so the next batch's own answer pays for it and
  // reserves another on its resend. Once one result is lost, every later
  // anonymous failure costs a RESULT_TIMEOUT_MS resend, until the host can
  // correlate a result to the send it answers.
  let staleAnonymousBudget = 0
  const retiredOpIds = new Set<string>()

  function retire(batch: InFlight, answered: number): void {
    const outstanding = batch.sends - answered
    if (outstanding <= 0) return
    staleAnonymousBudget += outstanding
    for (const opId of batch.opIds) retiredOpIds.add(opId)
  }

  function drainStaleCredit(): void {
    if (staleAnonymousBudget === 0) return
    staleAnonymousBudget--
    if (staleAnonymousBudget === 0) retiredOpIds.clear()
  }

  function reportSettleFailure(cause: unknown, errorType: string): void {
    reportError(cause, {
      errorType,
      tags: { feature_area: 'agent', operation: 'sync', outcome: 'degraded' }
    })
  }

  function guardedSettlementNotifier(
    errorType: string
  ): (outcome: BatchOutcome) => void {
    let reportedFailure = false
    return (outcome) => {
      try {
        deps.onBatchSettled(outcome)
      } catch (cause) {
        if (reportedFailure) return
        reportedFailure = true
        reportSettleFailure(cause, errorType)
      }
    }
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
    if (!trySend(batch)) {
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
    batch.sends++
    armResultTimeout(batch)
  }

  function trySend(batch: InFlight): boolean {
    try {
      return deps.sendOps(batch.workflowId, deps.tab, batch.ops)
    } catch (error) {
      if (!batch.reportedThrow) {
        batch.reportedThrow = true
        reportError(error, {
          surface: 'agent',
          errorType: 'failure_sending_agent_human_ops',
          tags: {
            failure_kind: 'caught_unexpected',
            feature_area: 'agent',
            operation: 'sync',
            outcome: 'recovered'
          },
          level: 'error'
        })
      }
      return false
    }
  }

  function settleUnbound(batch: InFlight): void {
    if (inFlight !== batch) return
    retire(batch, 0)
    settle({
      state: batch.sends > 0 ? 'unconfirmed' : 'undeliverable',
      ops: batch.ops
    })
  }

  function armResultTimeout(batch: InFlight): void {
    if (inFlight !== batch) return
    batch.timer = setTimeout(() => {
      if (inFlight !== batch) return
      if (batch.resent) {
        retire(batch, 0)
        settle({ state: 'unacknowledged', ops: batch.ops })
        return
      }
      // One silent-result resend of the SAME minted ops: idempotent at the
      // applier through the op_id gate.
      batch.resent = true
      batch.reportedThrow = false
      transmit(batch, 0)
    }, RESULT_TIMEOUT_MS)
  }

  function drainOutstanding(notify: (outcome: BatchOutcome) => void): void {
    seal()
    const queued = queue.splice(0)
    if (inFlight) {
      const batch = inFlight
      if (batch.timer) clearTimeout(batch.timer)
      retire(batch, 0)
      inFlight = null
      notify({
        state: batch.sends > 0 ? 'unconfirmed' : 'undeliverable',
        ops: batch.ops
      })
    }
    for (const batch of queued) {
      notify({ state: 'undeliverable', ops: batch.ops })
    }
  }

  function pump(): void {
    if (detached || inFlight !== null) return
    const queued = queue.shift()
    if (!queued) return
    inFlight = {
      workflowId: queued.workflowId,
      ops: queued.ops,
      opIds: new Set(queued.ops.map((op) => op.op_id)),
      sends: 0,
      reportedThrow: false,
      resent: false,
      parked: false,
      timer: null
    }
    transmit(inFlight, 0)
  }

  function admit(operations: GraphOperation[]): void {
    if (operations.length === 0) return
    const workflowId = deps.workflowId()
    if (workflowId !== lastMintedWorkflowId) {
      lastMintedVersion = -1
      lastMintedWorkflowId = workflowId
    }
    const baseVersion = Math.max(deps.baseVersion(), lastMintedVersion + 1)
    const actor = deps.actor()
    const minted = operations.flatMap((operation, index) =>
      mintWireOps([operation], { actor, baseVersion: baseVersion + index })
    )
    lastMintedVersion = baseVersion + minted.length - 1
    if (detached) {
      guardedSettlementNotifier('failure_settling_agent_op_sender_detach')({
        state: 'undeliverable',
        ops: minted
      })
      return
    }
    if (workflowId === null) {
      deps.onBatchSettled({ state: 'undeliverable', ops: minted })
      return
    }
    if (open?.workflowId !== workflowId) seal()
    if (open) open.ops.push(...minted)
    else open = { workflowId, ops: minted }
  }

  function seal(): void {
    if (!open) return
    const { workflowId, ops } = open
    open = null
    queue.push(...chunkWireOps(ops).map((ops) => ({ workflowId, ops })))
  }

  function flush(): void {
    seal()
    pump()
  }

  const unsubscribe = deps.onOpsResult((result) => {
    if (inFlight === null && staleAnonymousBudget === 0) return
    const identified = [...result.applied, ...result.skipped]
    if (result.failed?.op_id) identified.push(result.failed.op_id)
    const batch =
      inFlight !== null &&
      (result.workflowId === undefined ||
        result.workflowId === inFlight.workflowId)
        ? inFlight
        : null
    if (identified.length > 0) {
      if (batch && identified.some((opId) => batch.opIds.has(opId))) {
        retire(batch, 1)
        settle({ state: 'acknowledged', ops: batch.ops, result })
      } else if (identified.some((opId) => retiredOpIds.has(opId))) {
        // A retired batch's own answer consumes the credit reserved for it;
        // ops this sender never minted are nobody's answer here.
        drainStaleCredit()
      }
      return
    }
    // Anonymous failure (empty lists, no failed op_id): a late result with
    // no batch waiting, one addressed to another workflow, or one a stale
    // credit could explain drains that credit so it cannot swallow a future
    // batch's own result. Only then is it the in-flight batch's.
    if (batch === null || staleAnonymousBudget > 0) {
      drainStaleCredit()
      return
    }
    retire(batch, 1)
    settle({ state: 'acknowledged', ops: batch.ops, result })
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
      const batches = inFlight
        ? [{ workflowId: inFlight.workflowId, ops: inFlight.ops }]
        : []
      return [...batches, ...queue, ...(open ? [open] : [])]
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
      lastMintedVersion = -1
      lastMintedWorkflowId = null
      drainOutstanding(
        guardedSettlementNotifier('failure_settling_agent_op_sender_abort')
      )
    },
    detach() {
      if (detached) return
      detached = true
      try {
        drainOutstanding(
          guardedSettlementNotifier('failure_settling_agent_op_sender_detach')
        )
      } finally {
        unsubscribe()
      }
    }
  }
}
