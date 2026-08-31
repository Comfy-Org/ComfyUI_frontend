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
import { chunkWireOps, mintOrderedOpId, mintWireOps } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

export interface OpsResultView {
  /** The workflow the frame names; results for other workflows are ignored. */
  workflowId?: string
  ok: boolean
  applied: string[]
  skipped: string[]
  /** Failed-batch diagnostics when the host provides them; `op_id` correlates an otherwise empty-list failure to its batch. */
  failure?: { op_id?: string }
}

/**
 * Boundary adapter: normalize a raw `doc_ops_result` frame into the sender's
 * view. The wire's `failed` detail has shipped in two shapes (a single
 * `{op_id, code, message}` object, and the newer `{index, op, code, message}`
 * where `op` carries the op_id) and may arrive as an array; all of them
 * resolve to the `failure.op_id` the sender correlates on, so a host
 * rejection with empty applied/skipped lists keeps its batch identity.
 */
export function toOpsResultView(frame: {
  workflowId?: string
  ok: boolean
  applied?: unknown
  skipped?: unknown
  failed?: unknown
}): OpsResultView {
  const ids = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  const failure = normalizeFailure(frame.failed)
  return {
    ...(frame.workflowId !== undefined && { workflowId: frame.workflowId }),
    ok: frame.ok,
    applied: ids(frame.applied),
    skipped: ids(frame.skipped),
    ...(failure !== undefined && { failure })
  }
}

function normalizeFailure(failed: unknown): { op_id?: string } | undefined {
  if (failed == null) return undefined
  const single: unknown = Array.isArray(failed) ? failed[0] : failed
  if (typeof single !== 'object' || single === null) return {}
  const detail = single as { op_id?: unknown; op?: unknown }
  if (typeof detail.op_id === 'string') return { op_id: detail.op_id }
  const op = detail.op
  if (
    typeof op === 'object' &&
    op !== null &&
    typeof (op as { op_id?: unknown }).op_id === 'string'
  ) {
    return { op_id: (op as { op_id: string }).op_id }
  }
  return {}
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

interface QueuedBatch {
  ops: Op[]
  /**
   * The workflow the batch was minted for. Captured at mint time so a rebind
   * can never route already-minted ops (carrying the old doc's base_version)
   * to a different workflow: retries and queued delivery stay
   * document-scoped, and a rebind invalidates them as undeliverable.
   */
  workflowId: string | null
}

interface InFlight extends QueuedBatch {
  opIds: Set<string>
  resent: boolean
  resultTimer: ReturnType<typeof setTimeout> | null
  deliveryTimer: ReturnType<typeof setTimeout> | null
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: QueuedBatch[] = []
  let inFlight: InFlight | null = null
  let detached = false
  let opOrder = 0
  // Late-result credits: a batch that settled 'unacknowledged' was
  // transmitted twice, so up to two of its results may still arrive - as
  // ANONYMOUS failures (empty id lists, no failure op_id) they are
  // indistinguishable from the current batch's. Swallowing up to the credit
  // beats mis-attribution: a swallowed own-result only costs the idempotent
  // resend cycle, while a mis-attributed settle poisons everything
  // downstream of this seam.
  const staleAnonymousExpiries: number[] = []

  function consumeStaleAnonymousCredit(): boolean {
    const now = Date.now()
    while (
      staleAnonymousExpiries.length > 0 &&
      staleAnonymousExpiries[0] <= now
    ) {
      staleAnonymousExpiries.shift()
    }
    if (staleAnonymousExpiries.length === 0) return false
    staleAnonymousExpiries.shift()
    return true
  }

  function settle(outcome: BatchOutcome): void {
    if (inFlight?.resultTimer) clearTimeout(inFlight.resultTimer)
    if (inFlight?.deliveryTimer) clearTimeout(inFlight.deliveryTimer)
    inFlight = null
    deps.onBatchSettled(outcome)
    pump()
  }

  function transmit(batch: QueuedBatch, attempt: number): void {
    if (detached || inFlight?.ops !== batch.ops) return
    // Delivery is document-scoped: the batch carries the workflow it was
    // minted for, and a rebind since then invalidates it rather than routing
    // the old doc's ops (and base_version) to the new workflow.
    if (batch.workflowId === null || deps.workflowId() !== batch.workflowId) {
      settleUndeliverable(batch)
      return
    }
    if (!deps.sendOps(batch.workflowId, deps.tab, batch.ops)) {
      if (attempt < SEND_RETRY_LIMIT) {
        inFlight.deliveryTimer = setTimeout(() => {
          if (inFlight?.ops !== batch.ops) return
          inFlight.deliveryTimer = null
          transmit(batch, attempt + 1)
        }, SEND_RETRY_INTERVAL_MS)
      } else {
        settleUndeliverable(batch)
      }
      return
    }
    armResultTimeout(batch)
  }

  function settleUndeliverable(batch: QueuedBatch): void {
    if (inFlight?.ops === batch.ops) {
      settle({ state: 'undeliverable', ops: batch.ops })
    }
  }

  function armResultTimeout(batch: QueuedBatch): void {
    if (inFlight?.ops !== batch.ops) return
    inFlight.resultTimer = setTimeout(() => {
      if (inFlight?.ops !== batch.ops) return
      if (inFlight.resent) {
        const expiry = Date.now() + RESULT_TIMEOUT_MS
        staleAnonymousExpiries.push(expiry, expiry)
        settle({ state: 'unacknowledged', ops: batch.ops })
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
      ops: batch.ops,
      workflowId: batch.workflowId,
      opIds: new Set(batch.ops.map((op) => op.op_id)),
      resent: false,
      resultTimer: null,
      deliveryTimer: null
    }
    transmit(inFlight, 0)
  }

  const unsubscribe = deps.onOpsResult((result) => {
    // A result naming a different workflow can never be this sender's: it
    // neither settles the in-flight batch nor drains a stale credit.
    if (
      result.workflowId !== undefined &&
      result.workflowId !== (inFlight?.workflowId ?? deps.workflowId())
    ) {
      return
    }
    if (!inFlight) {
      // A late result with no batch waiting: drain a credit if one is
      // outstanding so it cannot swallow a future batch's own result.
      consumeStaleAnonymousCredit()
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
    if (consumeStaleAnonymousCredit()) return
    settle({ state: 'acknowledged', ops: inFlight.ops, result })
  })

  return {
    enqueue(operations) {
      if (detached || operations.length === 0) return
      const workflowId = deps.workflowId()
      const minted = mintWireOps(operations, {
        actor: deps.actor(),
        baseVersion: deps.baseVersion(),
        nextOpId: () => mintOrderedOpId(++opOrder)
      })
      queue.push(...chunkWireOps(minted).map((ops) => ({ ops, workflowId })))
      pump()
    },
    pending() {
      return queue.length + (inFlight ? 1 : 0)
    },
    detach() {
      detached = true
      if (inFlight?.resultTimer) clearTimeout(inFlight.resultTimer)
      if (inFlight?.deliveryTimer) clearTimeout(inFlight.deliveryTimer)
      inFlight = null
      queue.length = 0
      unsubscribe()
    }
  }
}
