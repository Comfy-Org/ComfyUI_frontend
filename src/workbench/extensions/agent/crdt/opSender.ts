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
import { chunkWireOps, mintWireOps, WIRE_MAX_OPS_PER_BATCH } from './opEnvelope'

const SEND_RETRY_LIMIT = 5
const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000
const LINEAGE_WAIT_TIMEOUT_MS = 30_000
const FAILURE_REPORT_WINDOW_MS = 60_000

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
   * Handle a lineage break. Ordinarily this has abortAll semantics because
   * the replacement seed already contains the human effect. A batch refused
   * with `pre_mint` is the exception: it provably never reached the applier,
   * so retain it and its FIFO successors for delivery after resubscribe.
   */
  handleLineageReset(): void
  /** Retry a retained pre-mint batch after the replacement lineage is bound. */
  resumeAfterLineage(): void
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
  waitingForLineage: boolean
  timer: ReturnType<typeof setTimeout> | null
}

function isExactPreMintRefusal(
  result: OpsResultView
): result is OpsResultView & { failed: NonNullable<OpsResultView['failed']> } {
  return (
    !result.ok &&
    result.applied.length === 0 &&
    result.skipped.length === 0 &&
    result.failed?.code === 'pre_mint' &&
    result.failed.index === 0
  )
}

export function createOpSender(deps: OpSenderDeps): OpSender {
  const queue: Array<{ workflowId: string; ops: Op[] }> = []
  let queueHead = 0
  let open: { workflowId: string; ops: Op[] } | null = null
  let inFlight: InFlight | null = null
  let lastMintedVersion = -1
  let lastMintedWorkflowId: string | null = null
  let detached = false
  let suspended = false
  let pumping = false
  let sealing = 0
  let pumpRequested = false
  let stateEpoch = 0
  let abortGeneration = 0
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
  let settlementFailureReports = 0
  let settlementFailureWindowStartedAt: number | null = null
  const MAX_SETTLEMENT_FAILURE_REPORTS = 3
  const chunkFailureWindows = new Map<
    string,
    { reports: number; startedAt: number }
  >()
  const MAX_CHUNK_FAILURE_REPORTS = 3

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

  function parkMatchingPreMintResult(
    result: OpsResultView,
    batch: InFlight | null
  ): boolean {
    if (batch === null || !isExactPreMintRefusal(result)) return false
    const opId = result.failed.op_id
    if (opId === undefined || !batch.opIds.has(opId)) return false
    if (batch.waitingForLineage) return true
    if (batch.timer) clearTimeout(batch.timer)
    batch.sends--
    batch.waitingForLineage = true
    batch.timer = setTimeout(() => {
      if (inFlight !== batch || !batch.waitingForLineage) return
      retire(batch, 0)
      settle({ state: 'unconfirmed', ops: batch.ops })
    }, LINEAGE_WAIT_TIMEOUT_MS)
    return true
  }

  function reportDegraded(cause: unknown, errorType: string): void {
    reportError(cause, {
      errorType,
      surface: 'agent',
      tags: { feature_area: 'agent', operation: 'sync', outcome: 'degraded' }
    })
  }

  function reportChunkFailure(cause: unknown, errorType: string): void {
    const now = performance.now()
    const current = chunkFailureWindows.get(errorType)
    const window =
      !current || now - current.startedAt >= FAILURE_REPORT_WINDOW_MS
        ? { reports: 0, startedAt: now }
        : current
    if (window.reports >= MAX_CHUNK_FAILURE_REPORTS) return
    window.reports++
    chunkFailureWindows.set(errorType, window)
    reportDegraded(cause, errorType)
  }

  function guardedSettlementNotifier(
    errorType: string
  ): (outcome: BatchOutcome) => void {
    let reportedFailure = false
    return (outcome) => {
      try {
        deps.onBatchSettled(outcome)
      } catch (cause) {
        const now = performance.now()
        if (
          settlementFailureWindowStartedAt === null ||
          now - settlementFailureWindowStartedAt >= FAILURE_REPORT_WINDOW_MS
        ) {
          settlementFailureReports = 0
          settlementFailureWindowStartedAt = now
        }
        if (
          reportedFailure ||
          settlementFailureReports >= MAX_SETTLEMENT_FAILURE_REPORTS
        )
          return
        reportedFailure = true
        settlementFailureReports++
        reportDegraded(cause, errorType)
      }
    }
  }

  const notifyDetachSettlement = guardedSettlementNotifier(
    'failure_settling_agent_op_sender_detach'
  )
  function settle(outcome: BatchOutcome): void {
    if (inFlight?.timer) clearTimeout(inFlight.timer)
    inFlight = null
    guardedSettlementNotifier('failure_settling_agent_op_sender')(outcome)
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

  function drainOutstanding(
    notify: (outcome: BatchOutcome) => void,
    chunkErrorType: string
  ): void {
    // Tear down live state before any fallible serialization or callback. A
    // malformed custom-node value must not leave timers or queued work behind.
    const unsealed = open
    open = null
    const queued = queue.slice(queueHead)
    queue.length = 0
    queueHead = 0
    const active = inFlight
    inFlight = null
    if (active) {
      const batch = active
      if (batch.timer) clearTimeout(batch.timer)
      retire(batch, 0)
      notify({
        state: batch.sends > 0 ? 'unconfirmed' : 'undeliverable',
        ops: batch.ops
      })
    }
    for (const batch of queued) {
      notify({ state: 'undeliverable', ops: batch.ops })
    }
    if (unsealed) {
      const chunks = safelyChunkWireOps(unsealed.ops, chunkErrorType)
      for (const ops of chunks) {
        notify({ state: 'undeliverable', ops })
      }
    }
  }

  function abortAll(): void {
    stateEpoch++
    abortGeneration++
    lastMintedVersion = -1
    lastMintedWorkflowId = null
    drainOutstanding(
      guardedSettlementNotifier('failure_settling_agent_op_sender_abort'),
      'failure_chunking_agent_op_sender_abort'
    )
  }

  function dequeue(): { workflowId: string; ops: Op[] } | undefined {
    if (queueHead >= queue.length) return
    const queued = queue[queueHead]
    queueHead++
    if (queueHead >= 1_024 && queueHead * 2 >= queue.length) {
      queue.splice(0, queueHead)
      queueHead = 0
    }
    return queued
  }

  function pump(): void {
    if (sealing > 0) {
      pumpRequested = true
      return
    }
    if (pumping) return
    pumping = true
    try {
      while (!detached && inFlight === null) {
        const queued = dequeue()
        if (!queued) return
        inFlight = {
          workflowId: queued.workflowId,
          ops: queued.ops,
          opIds: new Set(queued.ops.map((op) => op.op_id)),
          sends: 0,
          reportedThrow: false,
          resent: false,
          parked: false,
          waitingForLineage: false,
          timer: null
        }
        transmit(inFlight, 0)
      }
    } finally {
      pumping = false
    }
  }

  function admissionTargetOrSettle(
    minted: Op[],
    workflowId: string | null
  ): string | null {
    if (detached) {
      notifyDetachSettlement({ state: 'undeliverable', ops: minted })
      return null
    }
    if (workflowId === null) {
      guardedSettlementNotifier('failure_settling_agent_op_sender')({
        state: 'undeliverable',
        ops: minted
      })
      return null
    }
    return workflowId
  }

  function restoreReentrantAdmission(
    minted: Op[],
    admissionTarget: string,
    admissionEpoch: number,
    admissionAbortGeneration: number
  ): boolean {
    if (stateEpoch === admissionEpoch) return false
    if (detached) {
      notifyDetachSettlement({ state: 'undeliverable', ops: minted })
      return true
    }
    if (abortGeneration !== admissionAbortGeneration) {
      guardedSettlementNotifier('failure_settling_agent_op_sender_abort')({
        state: 'undeliverable',
        ops: minted
      })
      return true
    }
    if (open?.workflowId === admissionTarget) {
      open.ops = [...minted, ...open.ops]
      stateEpoch++
      return true
    }
    guardedSettlementNotifier('failure_settling_agent_op_sender')({
      state: 'undeliverable',
      ops: minted
    })
    return true
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
    const admissionTarget = admissionTargetOrSettle(minted, workflowId)
    if (admissionTarget === null) return
    const admissionEpoch = stateEpoch
    const admissionAbortGeneration = abortGeneration
    // seal() can synchronously re-enter the sender through its settlement
    // callback. Do not resurrect an aborted admission or append old-workflow
    // ops to state installed by a nested admit().
    if (open?.workflowId !== admissionTarget) seal()
    if (
      restoreReentrantAdmission(
        minted,
        admissionTarget,
        admissionEpoch,
        admissionAbortGeneration
      )
    )
      return
    if (open) for (const op of minted) open.ops.push(op)
    else open = { workflowId: admissionTarget, ops: minted }
    stateEpoch++
  }

  function sealInterruption(
    sealAbortGeneration: number
  ): 'detach' | 'abort' | null {
    if (detached) return 'detach'
    if (abortGeneration !== sealAbortGeneration) return 'abort'
    return null
  }

  function settleInterruptedSeal(ops: Op[], kind: 'detach' | 'abort'): void {
    const notify =
      kind === 'detach'
        ? notifyDetachSettlement
        : guardedSettlementNotifier('failure_settling_agent_op_sender_abort')
    settleInBoundedGroups(ops, notify)
  }

  function settleInBoundedGroups(
    ops: Op[],
    notify: (outcome: BatchOutcome) => void
  ): void {
    for (let index = 0; index < ops.length; index += WIRE_MAX_OPS_PER_BATCH) {
      notify({
        state: 'undeliverable',
        ops: ops.slice(index, index + WIRE_MAX_OPS_PER_BATCH)
      })
    }
  }

  function insertSealChunks(
    chunks: Op[][],
    workflowId: string,
    insertionIndex: number
  ): void {
    const nested = queue.splice(Math.min(insertionIndex, queue.length))
    for (const chunk of chunks) queue.push({ workflowId, ops: chunk })
    for (const batch of nested) queue.push(batch)
  }

  function recoverSeal(
    cause: unknown,
    workflowId: string,
    ops: Op[],
    sealAbortGeneration: number,
    insertionIndex: number
  ): void {
    const interruptedBeforeProbe = sealInterruption(sealAbortGeneration)
    if (interruptedBeforeProbe) {
      reportChunkFailure(
        cause,
        interruptedBeforeProbe === 'detach'
          ? 'failure_chunking_agent_op_sender_teardown'
          : 'failure_chunking_agent_op_sender_abort'
      )
      settleInterruptedSeal(ops, interruptedBeforeProbe)
      return
    }
    reportChunkFailure(cause, 'failure_chunking_agent_op_sender')
    const rejectedFrom = findRejectedFrom(ops, sealAbortGeneration)
    if (rejectedFrom === null) return

    const sendable = ops.slice(0, rejectedFrom)
    let rejected = ops.slice(rejectedFrom)
    try {
      const recovered = chunkWireOps(sendable)
      const interrupted = sealInterruption(sealAbortGeneration)
      if (interrupted) {
        settleInterruptedSeal(ops, interrupted)
        return
      }
      insertSealChunks(recovered, workflowId, insertionIndex)
    } catch (recoveryCause) {
      reportChunkFailure(
        recoveryCause,
        'failure_rechunking_agent_op_sender_recovery'
      )
      rejected = [...sendable, ...rejected]
    }
    const interrupted = sealInterruption(sealAbortGeneration)
    if (interrupted) {
      settleInterruptedSeal(ops, interrupted)
      return
    }
    if (rejected.length > 0)
      settleInBoundedGroups(
        rejected,
        guardedSettlementNotifier('failure_settling_agent_op_sender')
      )
  }

  function findRejectedFrom(
    ops: Op[],
    sealAbortGeneration: number
  ): number | null {
    for (const [index, op] of ops.entries()) {
      try {
        chunkWireOps([op])
      } catch {
        const interrupted = sealInterruption(sealAbortGeneration)
        if (interrupted) {
          settleInterruptedSeal(ops, interrupted)
          return null
        }
        return index
      }
      const interrupted = sealInterruption(sealAbortGeneration)
      if (interrupted) {
        settleInterruptedSeal(ops, interrupted)
        return null
      }
    }
    return ops.length
  }

  function seal(): boolean {
    if (!open) return detached
    const { workflowId, ops } = open
    const sealAbortGeneration = abortGeneration
    const insertionIndex = queue.length
    open = null
    sealing++
    try {
      const chunks = chunkWireOps(ops)
      const interrupted = sealInterruption(sealAbortGeneration)
      if (interrupted) settleInterruptedSeal(ops, interrupted)
      else insertSealChunks(chunks, workflowId, insertionIndex)
    } catch (cause) {
      recoverSeal(cause, workflowId, ops, sealAbortGeneration, insertionIndex)
    } finally {
      sealing--
      if (sealing === 0 && pumpRequested) {
        pumpRequested = false
        pump()
      }
    }
    return detached
  }

  function safelyChunkWireOps(ops: Op[], errorType: string): Op[][] {
    try {
      return chunkWireOps(ops)
    } catch (cause) {
      reportChunkFailure(cause, errorType)
      return ops.map((op) => [op])
    }
  }

  function flush(): void {
    seal()
    pump()
  }

  function matchingBatch(result: OpsResultView): InFlight | null {
    if (inFlight === null) return null
    if (
      result.workflowId !== undefined &&
      result.workflowId !== inFlight.workflowId
    )
      return null
    return inFlight
  }

  function identifiedOpIds(result: OpsResultView): string[] {
    const identified = [...result.applied, ...result.skipped]
    if (result.failed?.op_id) identified.push(result.failed.op_id)
    return identified
  }

  function handleIdentifiedResult(
    result: OpsResultView,
    batch: InFlight | null,
    identified: string[]
  ): void {
    if (batch && identified.some((opId) => batch.opIds.has(opId))) {
      retire(batch, 1)
      settle({ state: 'acknowledged', ops: batch.ops, result })
      return
    }
    if (identified.some((opId) => retiredOpIds.has(opId))) drainStaleCredit()
  }

  function handleAnonymousResult(
    result: OpsResultView,
    batch: InFlight | null
  ): void {
    // A late result with no batch waiting, one addressed to another workflow,
    // or one a stale credit could explain drains that credit before it can be
    // mistaken for the current batch's answer.
    if (batch === null || staleAnonymousBudget > 0) {
      drainStaleCredit()
      return
    }
    // A parked batch or one waiting for a transport retry has not sent yet.
    if (batch.sends === 0) return
    retire(batch, 1)
    settle({ state: 'acknowledged', ops: batch.ops, result })
  }

  const unsubscribe = deps.onOpsResult((result) => {
    if (detached) return
    if (inFlight === null && staleAnonymousBudget === 0) return
    const identified = identifiedOpIds(result)
    const batch = matchingBatch(result)
    if (parkMatchingPreMintResult(result, batch)) return
    if (batch?.waitingForLineage) return
    if (identified.length > 0) {
      handleIdentifiedResult(result, batch, identified)
      return
    }
    handleAnonymousResult(result, batch)
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
      return queue.length - queueHead + (inFlight ? 1 : 0) + (open ? 1 : 0)
    },
    pendingOps() {
      const batches = inFlight
        ? [{ workflowId: inFlight.workflowId, ops: inFlight.ops }]
        : []
      return [...batches, ...queue.slice(queueHead), ...(open ? [open] : [])]
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
      if (
        inFlight &&
        !inFlight.waitingForLineage &&
        deps.workflowId() !== inFlight.workflowId
      ) {
        settleUnbound(inFlight)
      }
    },
    handleLineageReset() {
      lastMintedVersion = -1
      lastMintedWorkflowId = null
      if (inFlight?.waitingForLineage) return
      abortAll()
    },
    resumeAfterLineage() {
      if (!inFlight?.waitingForLineage) return
      if (inFlight.timer) clearTimeout(inFlight.timer)
      inFlight.timer = null
      inFlight.waitingForLineage = false
      transmit(inFlight, 0)
    },
    abortAll,
    detach() {
      if (detached) return
      detached = true
      stateEpoch++
      try {
        drainOutstanding(
          notifyDetachSettlement,
          'failure_chunking_agent_op_sender_teardown'
        )
        // The listener is inert once detached. Release late-result bookkeeping
        // even if an injected unsubscribe implementation fails below.
        staleAnonymousBudget = 0
        retiredOpIds.clear()
      } finally {
        try {
          unsubscribe()
        } catch (cause) {
          reportDegraded(cause, 'failure_unsubscribing_agent_op_sender')
        }
      }
    }
  }
}
