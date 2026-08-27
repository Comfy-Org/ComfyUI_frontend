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

import type { GraphOperation } from './graphOperations'
import { chunkWireOps, mintWireOps } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

export interface OpsResultView {
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
  /** The bound workflow id, or null when no doc is bound (drops the batch). */
  workflowId(): string | null
  tab: string
  /** `human:<user>:<tab>` (vocabulary §7). */
  actor(): string
  /** The follower's last observed doc sequence (stamps `base_version`). */
  baseVersion(): number
  /**
   * Terminal per-batch report: 'acknowledged' carries the host's result;
   * 'unacknowledged' means one resend after silence also drew no result;
   * 'undeliverable' means the transport never carried it within the retry
   * budget or no doc was bound.
   */
  onBatchSettled(outcome: BatchOutcome): void
}

export type BatchOutcome =
  | { state: 'acknowledged'; ops: Op[]; result: OpsResultView }
  | { state: 'unacknowledged'; ops: Op[] }
  | { state: 'undeliverable'; ops: Op[] }

export interface OpSender {
  enqueue(operations: GraphOperation[]): void
  /** In-flight + queued batch count (observability; 0 = drained). */
  pending(): number
  detach(): void
}

interface InFlight {
  ops: Op[]
  opIds: Set<string>
  resent: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: Op[][] = []
  let inFlight: InFlight | null = null
  let detached = false
  // Late-result credits: a batch that settled 'unacknowledged' was
  // transmitted twice, so up to two of its results may still arrive - as
  // ANONYMOUS failures (empty id lists, no failure op_id) they are
  // indistinguishable from the current batch's. Swallowing up to the credit
  // beats mis-attribution: a swallowed own-result only costs the idempotent
  // resend cycle, while a mis-attributed settle poisons everything
  // downstream of this seam.
  let staleAnonymousBudget = 0

  function settle(outcome: BatchOutcome): void {
    if (inFlight?.timer) clearTimeout(inFlight.timer)
    inFlight = null
    deps.onBatchSettled(outcome)
    pump()
  }

  function transmit(batch: Op[], attempt: number): void {
    if (detached) return
    const workflowId = deps.workflowId()
    if (workflowId === null) {
      settleUndeliverable(batch)
      return
    }
    if (!deps.sendOps(workflowId, deps.tab, batch)) {
      if (attempt < SEND_RETRY_LIMIT) {
        setTimeout(() => transmit(batch, attempt + 1), SEND_RETRY_INTERVAL_MS)
      } else {
        settleUndeliverable(batch)
      }
      return
    }
    armResultTimeout(batch)
  }

  function settleUndeliverable(batch: Op[]): void {
    if (inFlight?.ops === batch) {
      settle({ state: 'undeliverable', ops: batch })
    }
  }

  function armResultTimeout(batch: Op[]): void {
    if (inFlight?.ops !== batch) return
    inFlight.timer = setTimeout(() => {
      if (inFlight?.ops !== batch) return
      if (inFlight.resent) {
        staleAnonymousBudget += 2
        settle({ state: 'unacknowledged', ops: batch })
        return
      }
      // One silent-result resend of the SAME minted ops: idempotent at the
      // applier through the op_id gate.
      inFlight.resent = true
      transmit(batch, 0)
    }, RESULT_TIMEOUT_MS)
  }

  function pump(): void {
    if (detached || inFlight !== null) return
    const batch = queue.shift()
    if (!batch) return
    inFlight = {
      ops: batch,
      opIds: new Set(batch.map((op) => op.op_id)),
      resent: false,
      timer: null
    }
    transmit(batch, 0)
  }

  const unsubscribe = deps.onOpsResult((result) => {
    if (!inFlight) {
      // A late result with no batch waiting: drain a credit if one is
      // outstanding so it cannot swallow a future batch's own result.
      if (staleAnonymousBudget > 0) staleAnonymousBudget--
      return
    }
    const identified = [...result.applied, ...result.skipped]
    if (result.failure?.op_id) identified.push(result.failure.op_id)
    if (identified.length > 0) {
      if (!identified.some((opId) => inFlight!.opIds.has(opId))) return
      settle({ state: 'acknowledged', ops: inFlight.ops, result })
      return
    }
    // Anonymous failure (empty lists, no failure op_id): only attribute it
    // to the in-flight batch once no stale credit could explain it.
    if (staleAnonymousBudget > 0) {
      staleAnonymousBudget--
      return
    }
    settle({ state: 'acknowledged', ops: inFlight.ops, result })
  })

  return {
    enqueue(operations) {
      if (detached || operations.length === 0) return
      const minted = mintWireOps(operations, {
        actor: deps.actor(),
        baseVersion: deps.baseVersion()
      })
      queue.push(...chunkWireOps(minted))
      pump()
    },
    pending() {
      return queue.length + (inFlight ? 1 : 0)
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
