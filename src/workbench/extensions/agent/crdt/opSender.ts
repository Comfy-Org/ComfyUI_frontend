/**
 * The human write leg's sender (plan 3.2/3.3): takes semantic
 * {@link GraphOperation}s from the mint ports, mints wire identity ONCE, and
 * drives `doc_ops` frames through the doc frame client with bounded retries
 * that never re-mint an `op_id` (changed-payload reuse rejects host-side;
 * an unchanged resend converges through the applier's idempotency gate).
 *
 * Batches are strictly serialized: one in-flight batch at a time, FIFO, so
 * op order on the wire matches mint order. A per-document producer clock
 * reserves every `base_version` before the first batch is dispatched.
 *
 * Outcome handling is deliberately the TODAY contract: `doc_ops_result` is a
 * binary applied/skipped split. The prefix-abort reconcile and per-op
 * outcome-union surfacing (lww-dropped, op_rejected, ...) land when the host
 * frame upgrade ships (a required backend dependency, recorded on the plan);
 * `onResult` is the seam they will replace.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import type {
  GraphMutationTarget,
  GraphOperation,
  TargetedGraphOperations
} from './graphOperations'
import { chunkWireOps, mintWireOps } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

export interface OpsResultView {
  workflowId: string
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
   * doc) is never carried or re-addressed and settles 'undeliverable' at once.
   */
  workflowId(): string | null
  tab: string
  /** `human:<user>:<tab>` (vocabulary §7). */
  actor(): string
  /** The follower's last observed doc sequence, used as a Lamport floor. */
  observedVersion(): number
  /** Persist a contiguous per-document producer-clock reservation. */
  reserveVersions(
    workflowId: string,
    observed: number,
    count: number
  ): number | null
  /**
   * Terminal per-batch report: 'acknowledged' carries the host's result;
   * 'unacknowledged' means one resend after silence also drew no result;
   * 'undeliverable' means the transport never carried it within the retry
   * budget.
   */
  onBatchSettled(outcome: BatchOutcome): void
}

export type BatchOutcome =
  | (BatchIdentity & { state: 'acknowledged'; result: OpsResultView })
  | (BatchIdentity & { state: 'unacknowledged' })
  | (BatchIdentity & { state: 'undeliverable' })
  | {
      state: 'rejected'
      target: GraphMutationTarget
      operations: GraphOperation[]
      reason: 'target_mismatch' | 'version_reservation_failed'
    }

export interface OpSender {
  enqueue(batch: TargetedGraphOperations): boolean
  /** In-flight + queued batch count (observability; 0 = drained). */
  pending(): number
  /**
   * Eager abort seam (FE #16637 residual): settle the in-flight batch
   * undeliverable NOW if its mint-time workflow no longer matches
   * `deps.workflowId()`, instead of waiting out the 10 s result-silence
   * window before the next transmit re-reads it. A caller with an earlier
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
  detach(): void
}

interface BatchIdentity {
  target: GraphMutationTarget
  /** The first immutable op id in this wire chunk. */
  batchId: string
  ops: Op[]
}

interface InFlight extends BatchIdentity {
  opIds: Set<string>
  resent: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: BatchIdentity[] = []
  let inFlight: InFlight | null = null
  let detached = false

  function settle(outcome: BatchOutcome): void {
    if (inFlight?.timer) clearTimeout(inFlight.timer)
    inFlight = null
    deps.onBatchSettled(outcome)
    pump()
  }

  function transmit(batch: InFlight, attempt: number): void {
    if (detached || inFlight !== batch) return
    // A lost subscription is not a transport that recovers in 500 ms: settle
    // now rather than spend the retry budget while later batches wait behind.
    if (deps.workflowId() !== batch.target.workflowId) {
      settleUndeliverable(batch)
      return
    }
    if (!deps.sendOps(batch.target.workflowId, deps.tab, batch.ops)) {
      if (attempt < SEND_RETRY_LIMIT) {
        // Tracked in the same slot as the result timer (they never overlap:
        // the result timer is armed only after a successful send) so
        // settle()/detach() clear a pending retry too.
        batch.timer = setTimeout(
          () => transmit(batch, attempt + 1),
          SEND_RETRY_INTERVAL_MS
        )
      } else {
        settleUndeliverable(batch)
      }
      return
    }
    armResultTimeout(batch)
  }

  function settleUndeliverable(batch: InFlight): void {
    if (inFlight === batch) {
      settle({
        state: 'undeliverable',
        target: batch.target,
        batchId: batch.batchId,
        ops: batch.ops
      })
    }
  }

  function armResultTimeout(batch: InFlight): void {
    if (inFlight !== batch) return
    batch.timer = setTimeout(() => {
      if (inFlight !== batch) return
      if (batch.resent) {
        settle({
          state: 'unacknowledged',
          target: batch.target,
          batchId: batch.batchId,
          ops: batch.ops
        })
        return
      }
      // One silent-result resend of the SAME minted ops: idempotent at the
      // applier through the op_id gate.
      batch.resent = true
      transmit(batch, 0)
    }, RESULT_TIMEOUT_MS)
  }

  function pump(): void {
    if (detached || inFlight !== null) return
    const queued = queue.shift()
    if (!queued) return
    inFlight = {
      target: queued.target,
      batchId: queued.batchId,
      ops: queued.ops,
      opIds: new Set(queued.ops.map((op) => op.op_id)),
      resent: false,
      timer: null
    }
    transmit(inFlight, 0)
  }

  const unsubscribe = deps.onOpsResult((result) => {
    const batch = inFlight
    if (!batch || result.workflowId !== batch.target.workflowId) return
    const identified = [...result.applied, ...result.skipped]
    if (result.failure?.op_id) identified.push(result.failure.op_id)
    if (!identified.some((opId) => batch.opIds.has(opId))) return
    settle({
      state: 'acknowledged',
      target: batch.target,
      batchId: batch.batchId,
      ops: batch.ops,
      result
    })
  })

  return {
    enqueue({ target, operations }) {
      if (detached || operations.length === 0) return false
      if (deps.workflowId() !== target.workflowId) {
        deps.onBatchSettled({
          state: 'rejected',
          target: { ...target },
          operations,
          reason: 'target_mismatch'
        })
        return false
      }
      const stableTarget = { ...target }
      const firstVersion = deps.reserveVersions(
        stableTarget.workflowId,
        deps.observedVersion(),
        operations.length
      )
      if (firstVersion === null) {
        deps.onBatchSettled({
          state: 'rejected',
          target: stableTarget,
          operations,
          reason: 'version_reservation_failed'
        })
        return false
      }
      const minted = mintWireOps(operations, {
        actor: deps.actor(),
        firstVersion
      })
      queue.push(
        ...chunkWireOps(minted).map((ops) => ({
          target: stableTarget,
          batchId: ops[0].op_id,
          ops
        }))
      )
      pump()
      return true
    },
    pending() {
      return queue.length + (inFlight ? 1 : 0)
    },
    abortIfUnbound() {
      if (inFlight && deps.workflowId() !== inFlight.target.workflowId) {
        settleUndeliverable(inFlight)
      }
    },
    detach() {
      detached = true
      if (inFlight?.timer) clearTimeout(inFlight.timer)
      inFlight = null
      queue.length = 0
      unsubscribe()
    }
  }
}
