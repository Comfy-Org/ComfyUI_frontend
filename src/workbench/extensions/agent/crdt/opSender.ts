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
   *
   *
   * If custom serialization re-enters and closes the open group, these ops are
   * sealed at the queue position they were admitted at, keeping their
   * `op_id`s, and delivery waits until they are placed. Mint order is
   * preserved per document, not across documents.
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
  let queueHead = 0
  let open: { workflowId: string; ops: Op[] } | null = null
  let inFlight: InFlight | null = null
  // One Lamport cursor per workflow, cleared only by that doc's reset: the
  // observed sequence reads 0 between a subscribe and its ack, so only the
  // cursor keeps a re-bound workflow's stamps past ones this actor used there.
  const lastMintedVersions = new Map<string, number>()
  let detached = false
  let suspended = false
  let pumping = false
  // Delivery deferral depth: a seal or an admission in progress parks the pump
  // until it unwinds, so work a reentrant serialization callback enqueues
  // cannot reach the wire ahead of the earlier-minted ops still being placed.
  let pumpDeferrals = 0
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

  /**
   * The counter the next op for `workflowId` mints at: at least the follower's
   * last observed sequence, and always past this actor's last mint for that
   * same doc. An unbound admission has no doc to be monotonic against.
   */
  function mintBaseVersion(workflowId: string | null): number {
    const observed = deps.baseVersion()
    if (workflowId === null) return observed
    const lastMinted = lastMintedVersions.get(workflowId)
    return lastMinted === undefined
      ? observed
      : Math.max(observed, lastMinted + 1)
  }

  /**
   * Kept for every workflow this actor has minted against, for this sender's
   * whole life: no eviction policy is safe here. A `subscribe` resets the
   * follower's observed sequence to 0 until `doc_subscribed` acks it, so an
   * edit made in that window mints against 0 and the cursor is the ONLY thing
   * keeping it past this actor's last stamp for that doc. Dropping a cursor
   * therefore does not "fall back to the observed sequence" — it hands a
   * re-bound workflow a counter it has already used, which is the stamp
   * collision this cursor exists to prevent. A retained cursor can only ever
   * raise a stamp (`Math.max`), never lower one, so retention is the safe
   * direction; the cost is one number per edited workflow per page session.
   */
  function rememberMintedVersion(workflowId: string, version: number): void {
    lastMintedVersions.set(workflowId, version)
  }

  function releasePumpDeferral(): void {
    pumpDeferrals--
    if (pumpDeferrals === 0 && pumpRequested) {
      pumpRequested = false
      pump()
    }
  }

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
    if (pumpDeferrals > 0) {
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
    admissionAbortGeneration: number,
    admissionInsertionIndex: number
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
    // The nested call closed the open group (or retargeted it at another doc),
    // so there is nothing left to merge into — but this sender is live, is not
    // aborted, and these ops are still addressed to a doc. Dropping them here
    // discarded a human edit the user had already made. Seal them at the queue
    // position they held when they were admitted instead: ahead of whatever the
    // nested call enqueued, carrying their original op ids.
    sealGroup(
      { workflowId: admissionTarget, ops: minted },
      admissionInsertionIndex
    )
    stateEpoch++
    return true
  }

  function admit(operations: GraphOperation[]): void {
    if (operations.length === 0) return
    const workflowId = deps.workflowId()
    const baseVersion = mintBaseVersion(workflowId)
    const actor = deps.actor()
    const minted = operations.flatMap((operation, index) =>
      mintWireOps([operation], { actor, baseVersion: baseVersion + index })
    )
    const admissionTarget = admissionTargetOrSettle(minted, workflowId)
    if (admissionTarget === null) return
    rememberMintedVersion(admissionTarget, baseVersion + minted.length - 1)
    // Hold delivery for the whole admission: seal() below can re-enter through
    // custom serialization and request a pump, and draining it before these ops
    // are placed would put later-minted work on the wire first.
    pumpDeferrals++
    try {
      const admissionEpoch = stateEpoch
      const admissionAbortGeneration = abortGeneration
      const admissionInsertionIndex = queue.length
      // seal() can synchronously re-enter the sender through its settlement
      // callback. Do not resurrect an aborted admission or append old-workflow
      // ops to state installed by a nested admit().
      if (open?.workflowId !== admissionTarget) seal()
      if (
        restoreReentrantAdmission(
          minted,
          admissionTarget,
          admissionEpoch,
          admissionAbortGeneration,
          admissionInsertionIndex
        )
      )
        return
      if (open) for (const op of minted) open.ops.push(op)
      else open = { workflowId: admissionTarget, ops: minted }
      stateEpoch++
    } finally {
      releasePumpDeferral()
    }
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

  /**
   * Chunk one admission group into wire batches at `insertionIndex`, the queue
   * position the group held when it was admitted. Delivery stays parked until
   * the seal unwinds, so a reentrant serialization callback cannot overtake it.
   */
  function sealGroup(
    { workflowId, ops }: { workflowId: string; ops: Op[] },
    insertionIndex: number
  ): void {
    const sealAbortGeneration = abortGeneration
    pumpDeferrals++
    try {
      const chunks = chunkWireOps(ops)
      const interrupted = sealInterruption(sealAbortGeneration)
      if (interrupted) settleInterruptedSeal(ops, interrupted)
      else insertSealChunks(chunks, workflowId, insertionIndex)
    } catch (cause) {
      recoverSeal(cause, workflowId, ops, sealAbortGeneration, insertionIndex)
    } finally {
      releasePumpDeferral()
    }
  }

  function seal(): boolean {
    if (!open) return detached
    const group = open
    const insertionIndex = queue.length
    open = null
    sealGroup(group, insertionIndex)
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

  const unsubscribe = deps.onOpsResult((result) => {
    if (detached) return
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
    // A parked batch or one waiting for a transport retry has not put a send
    // on the wire, so an anonymous result cannot belong to it.
    if (batch.sends === 0) return
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
      if (inFlight && deps.workflowId() !== inFlight.workflowId) {
        settleUnbound(inFlight)
      }
    },
    abortAll() {
      stateEpoch++
      abortGeneration++
      // A doc_reset breaks the lineage of the BOUND document only — the
      // follower dispatches this under an `isCurrentWorkflow` guard — so only
      // that cursor is against a document that no longer exists and only it
      // restarts from the new doc's sequence. Clearing the whole map would
      // discard the high-water mark of every other doc visited this session,
      // and returning to one of those before its observed sequence catches up
      // would then re-mint a counter this actor already used there, which is
      // the stamp collision this map exists to prevent.
      const resetWorkflowId = deps.workflowId()
      if (resetWorkflowId !== null) lastMintedVersions.delete(resetWorkflowId)
      drainOutstanding(
        guardedSettlementNotifier('failure_settling_agent_op_sender_abort'),
        'failure_chunking_agent_op_sender_abort'
      )
    },
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
