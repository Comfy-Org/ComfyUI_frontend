import { assert } from '@/base/assert'
import { reportError } from '@/platform/telemetry/reportError'

import type {
  DocFrameClient,
  DocOp,
  DocReseedResult,
  DocReset,
  DocSubscribed,
  DocUpdate
} from './docFrameClient'
import { wireLog } from './crdtLog'
import { RESEED_CONFLICT, STALE_SCHEMA_RESEED_REQUIRED } from './docFrameCodes'
import { FollowerDoc } from './followerDoc'
import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

/** A document update after the follower bridge has classified its provenance. */
export interface ClassifiedDocUpdate extends DocUpdate {
  catchUp: boolean
}

export function isLiveAgentUpdate(
  update: Pick<DocUpdate, 'actor'> &
    Partial<Pick<ClassifiedDocUpdate, 'catchUp'>>
): boolean {
  return update.catchUp === false && update.actor?.startsWith('agent:') === true
}

function trySend(send: () => boolean): boolean {
  try {
    return send()
  } catch (error) {
    reportError(error, {
      surface: 'agent',
      errorType: 'failure_sending_agent_doc_frame',
      logToConsole: false,
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'agent',
        operation: 'sync',
        outcome: 'recovered'
      },
      level: 'error'
    })
    wireLog.warn('frame_send_failed', 'outbound doc frame dropped', error)
    return false
  }
}

/**
 * Bridges server doc frames to the follower's semantic {@link FollowerDoc} and
 * re-dispatches them. It does NOT touch the layout store: the semantic doc is
 * applied to the domain stores by the ECS follower adapter. It never merges the
 * semantic update into layoutStore: semantic and layout state remain separate
 * Y.Docs.
 *
 * Subscription is modelled as INTENT reconciled against transport REALITY, and
 * teardown is failure-tolerant; see the two id fields and {@link destroy}.
 */
export class LayoutFollowerBridge extends EventTarget {
  /**
   * Reassigned only on a lineage break — an explicit `doc_reset`
   * ({@link onDocReset}) or a subscribe to a DIFFERENT workflow
   * ({@link subscribe}) — because folding one document's history into another
   * merges two unrelated lineages: the next subscribe would carry the old
   * doc's state vector, the host would compute a nonsense delta against it,
   * and both workflows' nodes would land on one canvas (FEB-5).
   */
  private followerDoc = new FollowerDoc()
  /**
   * The workflow whose lineage {@link followerDoc} holds — the id passed to
   * the most recent {@link subscribe}. Unlike {@link desiredWorkflowId} it
   * survives {@link unsubscribe}, because detaching does not empty the doc:
   * a later subscribe to a DIFFERENT workflow must still re-mint it.
   */
  private lineageWorkflowId: string | null = null
  /**
   * Subscription INTENT — the workflow the app wants followed. Set
   * synchronously by the caller; independent of whether any frame has left the
   * transport yet.
   */
  private desiredWorkflowId: string | null = null
  /**
   * Subscription REALITY — the workflow a `doc_subscribe` frame actually left
   * the transport for. Only this gates inbound updates.
   *
   * Splitting the two is the fix for the "panel mounted before the socket
   * opened" trap: the old single `workflowId` field was set BEFORE the send,
   * so a send that could not go out still latched the field and the
   * `if (this.workflowId === workflowId) return` guard blocked every retry —
   * permanently, because `api` only dispatches `reconnected` on a RE-connect,
   * never on the first successful open.
   */
  private sentWorkflowId: string | null = null
  /**
   * The most recent KA-11 read-gate failure, while the merged doc is still
   * unreadable. Cleared by a lineage break ({@link dropDocForNewLineage}) or
   * by a later same-lineage frame that merges and leaves the doc readable
   * again — see {@link onDocUpdate}.
   */
  private schemaError: FollowerSchemaError | null = null
  private lastSeq: number | null = null
  private attemptFirstSeq: number | null = null
  private attemptLastSeq: number | null = null
  private integratedSeq: number | null = null
  private ackSeq: number | null = null
  /**
   * Armed by the ack, disarmed by the first applied frame whose seq equals
   * {@link ackSeq}. The relay joins the fanout BEFORE it acks, so a live frame
   * N+1 can reach the follower ahead of `doc_subscribed(seq=N)` and the
   * catch-up `doc_update(seq=N)`. The catch-up is the only frame carrying what
   * this follower's state vector lacked; if the stale check judged it against
   * the already-applied N+1 it would be dropped and the hole would never show
   * up as a gap. While armed, exactly one frame at seq == ackSeq bypasses the
   * stale check (Yjs integration is idempotent, so a true duplicate is
   * harmless). It never moves {@link lastSeq} backwards.
   */
  private catchUpPending = false
  private pendingReseedWorkflowId: string | null = null
  private reseedToken: { workflowId: string; expectedSeq: number } | null = null
  private reseedBlockedUntilConfirmedWorkflowId: string | null = null

  constructor(private readonly client: DocFrameClient) {
    super()
    client.addEventListener('doc_update', this.onDocUpdate)
    client.addEventListener('doc_reset', this.onDocReset)
    client.addEventListener('doc_subscribed', this.onDocSubscribed)
    client.addEventListener('doc_ops_result', this.forwardFrame)
    client.addEventListener('doc_reseed_result', this.onDocReseedResult)
  }

  /** The semantic doc this bridge currently follows. */
  get follower(): FollowerDoc {
    return this.followerDoc
  }

  /** The workflow a subscribe frame actually went out for, if any. */
  get subscribedWorkflowId(): string | null {
    return this.sentWorkflowId
  }

  /** The higher of the last applied doc seq and the current subscribe's ack. */
  get lastSequence(): number {
    return Math.max(this.lastSeq ?? 0, this.ackSeq ?? 0)
  }

  get isSubscribeBaselineIntegrated(): boolean {
    return (
      this.ackSeq !== null &&
      this.integratedSeq !== null &&
      this.integratedSeq >= this.ackSeq &&
      this.schemaError === null
    )
  }

  /** The KA-11 read-gate failure that closed this bridge's read path, if any. */
  get lastSchemaError(): FollowerSchemaError | null {
    return this.schemaError
  }

  /** True while intent and reality disagree — i.e. a retry is still owed. */
  get hasPendingSubscribe(): boolean {
    return (
      this.desiredWorkflowId !== null &&
      this.sentWorkflowId !== this.desiredWorkflowId
    )
  }

  /**
   * Follow a workflow. Subscribing to a DIFFERENT workflow than the one this
   * bridge's doc holds is a lineage break (FEB-5): the doc is re-minted so
   * the subscribe carries an empty state vector, and `follower_replaced` is
   * dispatched — unconditionally, even when the send could not leave a closed
   * socket — so consumers rebind their observers to the new doc rather than
   * staying attached to the destroyed one. Re-subscribing to the SAME
   * workflow keeps the doc: that is the same-lineage catch-up path
   * (ADR-GRAPH-DOCUMENT-0024), where the state vector makes the delta cheap.
   */
  subscribe(workflowId: string): void {
    const lineage = this.lineageWorkflowId
    if (this.desiredWorkflowId !== workflowId) {
      this.reseedBlockedUntilConfirmedWorkflowId = null
      this.reseedToken = null
    }
    this.lineageWorkflowId = workflowId
    this.desiredWorkflowId = workflowId
    if (lineage !== null && lineage !== workflowId) {
      this.dropDocForNewLineage()
      this.dispatchEvent(
        new CustomEvent('follower_replaced', { detail: { workflowId } })
      )
      this.reconcile()
      return
    }
    this.reconcile()
  }

  /** Drive intent at the transport. Idempotent and safe to call at any time. */
  reconcile(): boolean {
    const desired = this.desiredWorkflowId
    if (this.sentWorkflowId !== null && this.sentWorkflowId !== desired) {
      const sent = this.sentWorkflowId
      this.sentWorkflowId = null
      trySend(() => this.client.unsubscribe(sent))
    }
    if (desired === null || this.sentWorkflowId === desired) return false
    if (
      trySend(() => this.client.subscribe(desired, this.follower.stateVector()))
    ) {
      this.sentWorkflowId = desired
      this.attemptFirstSeq = null
      this.attemptLastSeq = null
      this.ackSeq = null
      this.catchUpPending = false
      this.dispatchEvent(
        new CustomEvent('doc_subscribe_sent', {
          detail: { workflowId: desired }
        })
      )
      return true
    }
    return false
  }

  resubscribe(): boolean {
    this.sentWorkflowId = null
    return this.reconcile()
  }

  reconnect(): void {
    this.reseedBlockedUntilConfirmedWorkflowId = null
    this.reseedToken = null
    this.resubscribe()
  }

  unsubscribe(): void {
    this.desiredWorkflowId = null
    this.reconcile()
  }

  reseed(workflowId: string, workflow: Record<string, unknown>): boolean {
    const expectedSeq = this.reseedSequenceFor(workflowId)
    if (expectedSeq === null) {
      assert(
        false,
        'followers send a whole canvas only to answer a current stale-schema refusal — see ADR-CRDT-FOLLOWER-0025',
        { workflowId }
      )
      return false
    }
    this.reseedToken = null
    if (!trySend(() => this.client.reseed(workflowId, expectedSeq, workflow)))
      return false
    this.pendingReseedWorkflowId = workflowId
    return true
  }

  canReseed(workflowId: string): boolean {
    return this.reseedSequenceFor(workflowId) !== null
  }

  private reseedSequenceFor(workflowId: string): number | null {
    const token = this.reseedToken
    return token?.workflowId === workflowId &&
      workflowId === this.desiredWorkflowId &&
      workflowId !== this.reseedBlockedUntilConfirmedWorkflowId
      ? token.expectedSeq
      : null
  }

  sendHumanOps(tab: string, ops: DocOp[]): void {
    const workflowId = this.sentWorkflowId
    if (workflowId === null || ops.length === 0) return
    trySend(() => this.client.sendOps(workflowId, tab, ops))
  }

  /**
   * Release everything this bridge owns. Teardown is failure-tolerant: the
   * unsubscribe is best-effort and can never prevent the listener detach or the
   * Y.Doc destroy, because a bridge that survives its composable keeps applying
   * remote updates through an adapter still wired to the live stores.
   */
  destroy(): void {
    try {
      this.unsubscribe()
    } finally {
      this.client.removeEventListener('doc_update', this.onDocUpdate)
      this.client.removeEventListener('doc_reset', this.onDocReset)
      this.client.removeEventListener('doc_subscribed', this.onDocSubscribed)
      this.client.removeEventListener('doc_ops_result', this.forwardFrame)
      this.client.removeEventListener(
        'doc_reseed_result',
        this.onDocReseedResult
      )
      this.desiredWorkflowId = null
      this.sentWorkflowId = null
      this.followerDoc.destroy()
    }
  }

  private readonly onDocUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    if (update.workflowId !== this.sentWorkflowId) return

    const isCatchUp = this.catchUpPending && update.seq === this.ackSeq
    if (this.rejectStaleUpdate(update, isCatchUp)) return

    if (this.rejectSequenceGap(update)) return
    this.recordAppliedSequence(update.seq)
    this.follower.applyRemoteUpdate(update.update)
    this.recordIntegratedSequence(update.seq, isCatchUp)

    if (!this.isReadableUpdate(update)) return

    const classifiedUpdate: ClassifiedDocUpdate = {
      ...update,
      catchUp: isCatchUp
    }
    this.dispatchEvent(
      new CustomEvent('doc_update', {
        detail: classifiedUpdate
      })
    )
  }

  private rejectStaleUpdate(update: DocUpdate, isCatchUp: boolean): boolean {
    if (isCatchUp || this.lastSeq === null || update.seq > this.lastSeq)
      return false
    this.dispatchEvent(
      new CustomEvent('doc_stale', {
        detail: { workflowId: update.workflowId, seq: update.seq }
      })
    )
    return true
  }

  private recordAppliedSequence(seq: number): void {
    this.lastSeq = Math.max(this.lastSeq ?? seq, seq)
    this.attemptFirstSeq ??= seq
    this.attemptLastSeq = Math.max(this.attemptLastSeq ?? seq, seq)
  }

  private rejectSequenceGap(update: DocUpdate): boolean {
    const baseline =
      this.ackSeq === null
        ? this.attemptLastSeq
        : Math.max(this.attemptLastSeq ?? 0, this.ackSeq)
    if (baseline === null || update.seq <= baseline + 1) return false
    this.reportGap(update.workflowId, baseline + 1, update.seq)
    return true
  }

  private rejectPreAckGap(workflowId: string): void {
    if (
      this.ackSeq === null ||
      this.attemptFirstSeq === null ||
      this.attemptFirstSeq <= this.ackSeq + 1
    )
      return
    this.reportGap(workflowId, this.ackSeq + 1, this.attemptFirstSeq)
  }

  private reportGap(workflowId: string, expected: number, received: number) {
    this.dispatchEvent(
      new CustomEvent('doc_gap', { detail: { workflowId, expected, received } })
    )
    this.resubscribe()
  }

  private isReadableUpdate(update: DocUpdate): boolean {
    try {
      assertReadableSchema(this.follower.doc)
      this.schemaError = null
      return true
    } catch (error) {
      if (!(error instanceof FollowerSchemaError)) throw error
      this.schemaError = error
      this.dispatchEvent(
        new CustomEvent('schema_error', {
          detail: { workflowId: update.workflowId, found: error.found }
        })
      )
      return false
    }
  }

  /**
   * Lineage break (`doc_reset`): dispatch while the old doc is still readable,
   * then replace it exactly once and pull the new lineage from an empty vector.
   * `follower_replaced` lets consumers rebind Yjs observers after replacement.
   */
  private readonly onDocReset: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const reset = event.detail as DocReset
    if (reset.workflowId !== this.sentWorkflowId) return
    this.dispatchEvent(new CustomEvent('doc_reset', { detail: reset }))
    this.dropDocForNewLineage()
    this.resubscribe()
    this.dispatchEvent(new CustomEvent('follower_replaced', { detail: reset }))
  }

  private dropDocForNewLineage(): void {
    this.followerDoc.destroy()
    this.followerDoc = new FollowerDoc()
    this.schemaError = null
    this.lastSeq = null
    this.attemptFirstSeq = null
    this.attemptLastSeq = null
    this.integratedSeq = null
    this.ackSeq = null
    this.catchUpPending = false
  }

  private readonly onDocSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const subscribed = event.detail as DocSubscribed
    if (subscribed.workflowId !== this.sentWorkflowId) return
    this.reseedToken =
      subscribed.workflowId !== this.reseedBlockedUntilConfirmedWorkflowId &&
      !subscribed.ok &&
      subscribed.code === STALE_SCHEMA_RESEED_REQUIRED &&
      subscribed.expectedSeq
        ? {
            workflowId: subscribed.workflowId,
            expectedSeq: subscribed.expectedSeq
          }
        : null
    if (!subscribed.ok) {
      this.ackSeq = null
      this.catchUpPending = false
      this.sentWorkflowId = null
      this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
      return
    }
    this.reseedBlockedUntilConfirmedWorkflowId = null
    this.ackSeq = subscribed.seq ?? 0
    this.catchUpPending = this.ackSeq > 0
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
    this.rejectPreAckGap(subscribed.workflowId)
  }

  private recordIntegratedSequence(seq: number, isCatchUp: boolean): void {
    if (isCatchUp) {
      this.catchUpPending = false
      this.integratedSeq = Math.max(
        this.integratedSeq ?? 0,
        this.lastSeq ?? seq
      )
    } else if (
      (this.integratedSeq !== null && seq === this.integratedSeq + 1) ||
      (this.ackSeq === 0 && seq === 1)
    ) {
      this.integratedSeq = seq
    }
  }

  private readonly onDocReseedResult: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const result = event.detail as DocReseedResult
    if (result.workflowId !== this.pendingReseedWorkflowId) return
    this.pendingReseedWorkflowId = null
    this.dispatchEvent(new CustomEvent(event.type, { detail: result }))
    if (result.workflowId !== this.desiredWorkflowId) return
    if (!result.ok && result.code !== RESEED_CONFLICT) return
    this.reseedBlockedUntilConfirmedWorkflowId = result.workflowId
    const reset: DocReset = {
      workflowId: result.workflowId,
      seq: result.seq ?? 0,
      lineageSeq: result.seq ?? 0,
      actor: 'system:client-seed'
    }
    this.dispatchEvent(new CustomEvent('doc_reset', { detail: reset }))
    this.dropDocForNewLineage()
    this.resubscribe()
    this.dispatchEvent(new CustomEvent('follower_replaced', { detail: reset }))
  }

  private readonly forwardFrame: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
  }
}
