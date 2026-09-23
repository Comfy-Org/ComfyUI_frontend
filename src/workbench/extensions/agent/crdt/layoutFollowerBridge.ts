import { reportError } from '@/platform/telemetry/reportError'

import type {
  DocFrameClient,
  DocOp,
  DocReset,
  DocSubscribed,
  DocUpdate
} from './docFrameClient'
import { wireLog } from './crdtLog'
import { FollowerDoc } from './followerDoc'
import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

/** A document update after the follower bridge has classified its provenance. */
export interface ClassifiedDocUpdate extends DocUpdate {
  catchUp: boolean
}

/**
 * Outbound frames are advisory: the follower's correctness never depends on one
 * arriving. A transport that cannot carry a frame reports `false`; one that
 * throws (the shape `apiTransport` had before this seam was fixed, and the shape
 * any future transport might regress to) is contained here rather than being
 * allowed to abort a Vue watcher or an unmount hook.
 */
function trySend(send: () => boolean): boolean {
  try {
    return send()
  } catch (error) {
    reportError(error, {
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
  /** Set once a merged doc failed the KA-11 read gate; never rendered after. */
  private schemaError: FollowerSchemaError | null = null
  /**
   * Highest doc seq APPLIED since the last subscribe left the transport;
   * `null` until the first post-subscribe update, so catch-up re-baselines
   * instead of being compared across a resubscribe. See the gap detector in
   * {@link onDocUpdate}.
   */
  private lastSeq: number | null = null
  /**
   * The host's seq at the moment it acknowledged the current subscribe
   * (`doc_subscribed.seq`); `null` until that ack lands. It is NOT an applied
   * baseline — the catch-up carrying that very seq may still be in flight, or
   * may never come when the follower was already current — so it never gates
   * a frame as stale. It only arms the gap detector before the first applied
   * update and stands in for {@link lastSeq} in {@link lastSequence} while no
   * update has been applied.
   */
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
  /**
   * Incremented once per subscribe frame this bridge actually sends
   * ({@link reconcile}'s successful `client.subscribe` call) — never per
   * ack. Forwarded on `doc_subscribed` so a consumer (`pendingCorrelation.ts`)
   * can tell a fresh ack from a duplicate or delayed-retry ack of the SAME
   * subscribe apart: both name this bridge's current `sentWorkflowId` and
   * both pass its guard, so sequence equality with some prior state alone
   * cannot distinguish them. This is a same-session counter, not a protocol
   * generation token the host echoes back — that token does not exist yet
   * (ADR-CRDT-RECONCILE-0035 (a)'s missing-generation-token gap), so it
   * cannot prove the ack belongs to THIS bridge's history versus a doc the
   * host silently reminted under the same workflow id.
   */
  private subscribeGeneration = 0
  /**
   * Generations still awaiting their ack, oldest first — send-to-response
   * identity, since the wire carries no request id the ack could echo back
   * (ADR-CRDT-RECONCILE-0035 (a)'s missing-generation-token gap). The
   * transport preserves order, so the OLDEST outstanding send is always the
   * one the NEXT ack for this workflow answers; `onDocSubscribed` dequeues
   * from the front rather than reading {@link subscribeGeneration} at
   * receipt time, which would relabel a delayed generation-1 ack as
   * generation 2 once a resubscribe has sent a second request. Cleared
   * whenever the subscription for the current workflow is abandoned (a
   * different workflow, or an explicit unsubscribe) — see {@link
   * reconcile}'s switching-away branch — since a straggling ack for it would
   * already fail the `sentWorkflowId` guard and must not be misattributed
   * to whatever is subscribed next.
   */
  private pendingGenerations: number[] = []
  /**
   * The `seq` of the last `doc_reset` this bridge actually applied for the
   * CURRENT lineage; `null` until one lands, and cleared whenever the doc is
   * replaced for a different lineage ({@link dropDocForNewLineage}). Guards
   * {@link onDocReset} against a duplicate delivery of the SAME reset (the
   * transport gives no exactly-once guarantee): a second frame naming this
   * exact seq is a repeat, not a new lineage break, so it must not re-drop
   * the just-reminted doc or re-send a subscribe the first delivery already
   * sent. Compared by exact seq equality, never "within a window" — a later,
   * genuinely new reset for this lineage always carries a different seq and
   * must still process normally.
   */
  private lastAppliedResetSeq: number | null = null
  /**
   * Identity (workflowId, seq, ok) of the last ack this bridge dequeued a
   * generation for. Without a host-echoed request id this queue cannot PROVE
   * two acks are the same delivery, so it only refuses to let an ack whose
   * identity repeats the one just consumed steal a barrier that was ALREADY
   * outstanding at that consumption — see {@link lastConsumptionHadNewerSend}
   * for why that, not merely "the queue is non-empty right now", is the
   * signal: `[ack1, duplicate ack1, ack2]` must dequeue `[1, 1, 2]`, never
   * `[1, 2, 2]`. This is deliberately conservative, not exact: a genuinely
   * identical re-ack of a generation whose slot has already been consumed
   * with nothing else outstanding is left to the ordinary fallback below, and
   * if this rule ever swallows a legitimate repeat ack instead, the bounded
   * retry / ack-timeout resubscribe recovers — the safe direction per
   * ADR-CRDT-RECONCILE-0035 (a)'s missing-generation-token gap.
   */
  private lastConsumedAckIdentity: {
    workflowId: string
    seq: number | undefined
    ok: boolean
  } | null = null
  /** The generation {@link lastConsumedAckIdentity} was dequeued as. */
  private lastConsumedGeneration = 0
  /**
   * True iff, at the moment {@link lastConsumedAckIdentity} was dequeued,
   * ANOTHER generation was already outstanding too (queued concurrently,
   * before either had an ack) — the FIFO front and one more behind it. This
   * is captured once at consumption and reused for however many later acks
   * repeat that identity, rather than re-read from the live queue: by the
   * time a second, unrelated subscribe (tab-away then back) sends its own
   * request and its ack happens to carry the same (workflowId, seq, ok) as
   * an earlier, fully-settled one, the queue is back to holding only that
   * ack's own entry — indistinguishable, by length alone, from the
   * concurrent-outstanding case this guards. Recording the fact at the
   * moment it was true keeps that ordinary sequential resubscribe from being
   * misread as a duplicate of its predecessor.
   */
  private lastConsumptionHadNewerSend = false

  constructor(private readonly client: DocFrameClient) {
    super()
    client.addEventListener('doc_update', this.onDocUpdate)
    client.addEventListener('doc_reset', this.onDocReset)
    client.addEventListener('doc_subscribed', this.onDocSubscribed)
    client.addEventListener('doc_ops_result', this.forwardFrame)
  }

  /** The semantic doc this bridge currently follows. */
  get follower(): FollowerDoc {
    return this.followerDoc
  }

  /** The workflow a subscribe frame actually went out for, if any. */
  get subscribedWorkflowId(): string | null {
    return this.sentWorkflowId
  }

  /**
   * The host seq this follower is known to be at: the last applied update, or
   * — before any update has been applied for the current subscribe — the seq
   * the host acknowledged. An already-current follower receives an ack and no
   * catch-up, so without the fallback the outbound op `baseVersion` would sit
   * at 0 until the next live frame.
   */
  get lastSequence(): number {
    return this.lastSeq ?? this.ackSeq ?? 0
  }

  /**
   * The highest seq this follower has actually APPLIED for the current
   * subscribe, or `null` while none has. Unlike {@link lastSequence} it never
   * falls back to the ack seq: the ack only says where the host is, not what
   * this doc holds, and the catch-up carrying that seq may still be in flight.
   * Use this wherever "the follower has projected seq N" is the question
   * (s3-opt-2 skipped-duplicate resolution); use {@link lastSequence} for the
   * outbound `baseVersion`, where the ack fallback is what an already-current
   * follower needs.
   */
  get lastAppliedSequence(): number | null {
    return this.lastSeq
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

  /**
   * Drive intent at the transport. Idempotent and safe to call at any time —
   * the composition root calls it whenever the socket may have become usable
   * (first open, reconnect, any `status` frame), which is what makes a subscribe
   * attempted against a closed socket recoverable.
   */
  reconcile(): void {
    const desired = this.desiredWorkflowId
    if (this.sentWorkflowId !== null && this.sentWorkflowId !== desired) {
      // Best effort. If the frame cannot leave, the socket is down and the
      // server has already dropped this subscription with it, so the local
      // record is cleared either way.
      const sent = this.sentWorkflowId
      this.sentWorkflowId = null
      this.pendingGenerations = []
      trySend(() => this.client.unsubscribe(sent))
    }
    if (desired === null || this.sentWorkflowId === desired) return
    if (
      trySend(() => this.client.subscribe(desired, this.follower.stateVector()))
    ) {
      this.sentWorkflowId = desired
      this.lastSeq = null
      this.ackSeq = null
      this.catchUpPending = false
      this.subscribeGeneration += 1
      this.pendingGenerations.push(this.subscribeGeneration)
      this.dispatchEvent(
        new CustomEvent('doc_subscribe_sent', {
          detail: { workflowId: desired, generation: this.subscribeGeneration }
        })
      )
    }
  }

  resubscribe(): void {
    this.sentWorkflowId = null
    this.reconcile()
  }

  unsubscribe(): void {
    this.desiredWorkflowId = null
    this.reconcile()
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
      this.desiredWorkflowId = null
      this.sentWorkflowId = null
      this.followerDoc.destroy()
    }
  }

  private readonly onDocUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    if (update.workflowId !== this.sentWorkflowId) return

    // The first incompatible frame is already in the Y.Doc. Same-lineage
    // updates cannot remove those CRDT bytes, so keep the read gate latched
    // until an explicit doc_reset replaces the lineage.
    if (this.schemaError !== null) return

    // A stale/duplicate frame cannot advance the replica. Ignoring it also
    // prevents a replayed Yjs frame from spuriously re-running ECS effects.
    // The one exception is the subscribe's own catch-up (seq == ackSeq) when
    // a live frame overtook the ack: see {@link catchUpPending}.
    // Deliberately compares against lastSeq, never ackSeq: while lastSeq is
    // null the catch-up arrives AT ackSeq, so `<= ackSeq` would drop it and
    // leave the follower on an empty doc (KA-11).
    const isCatchUp = this.catchUpPending && update.seq === this.ackSeq
    if (this.rejectStaleUpdate(update, isCatchUp)) return

    // Seq is only a gap detector. A jump withholds the uncertain frame and
    // asks the host for a same-lineage state-vector delta using this EXACT
    // follower doc. Only an explicit doc_reset may replace it (ADR-GRAPH-DOCUMENT-0024).
    //
    // Before the first applied update the detector is armed from the ack seq
    // N instead: the catch-up (seq N) and the first live frame (seq N+1) are
    // both contiguous with it, so neither trips it, while a first frame at
    // N+2 or beyond is a real drop. Nothing arms it before the ack lands.
    if (this.rejectSequenceGap(update)) return
    if (this.lastSeq === null || update.seq > this.lastSeq)
      this.lastSeq = update.seq
    if (isCatchUp) this.catchUpPending = false
    this.follower.applyRemoteUpdate(update.update)

    // KA-11 read-time gate. The frame must merge before its schema can be
    // checked, but nothing downstream may READ a doc whose declared schema
    // this build was not written against. Failing closed here, before the
    // frame is re-dispatched, is what keeps a v2 doc from being half-projected
    // onto the canvas by a v1 reader.
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

  private rejectSequenceGap(update: DocUpdate): boolean {
    const baseline = this.lastSeq ?? this.ackSeq
    if (baseline === null || update.seq <= baseline + 1) return false
    this.dispatchEvent(
      new CustomEvent('doc_gap', {
        detail: {
          workflowId: update.workflowId,
          expected: baseline + 1,
          received: update.seq
        }
      })
    )
    this.resubscribe()
    return true
  }

  private isReadableUpdate(update: DocUpdate): boolean {
    try {
      assertReadableSchema(this.follower.doc)
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
    // A repeat delivery of the SAME reset (identical seq, same lineage) must
    // be a no-op: the first delivery already reminted the doc and resent the
    // subscribe, so doing either again would drop a doc that just caught up
    // and send a redundant `doc_subscribe`.
    if (reset.seq === this.lastAppliedResetSeq) return
    this.dispatchEvent(new CustomEvent('doc_reset', { detail: reset }))
    this.dropDocForNewLineage()
    this.lastAppliedResetSeq = reset.seq
    this.resubscribe()
    this.dispatchEvent(new CustomEvent('follower_replaced', { detail: reset }))
  }

  /**
   * Replace the doc after an explicit lineage reset so the next subscribe
   * carries an empty state vector and pulls the new folded state.
   */
  private dropDocForNewLineage(): void {
    this.followerDoc.destroy()
    this.followerDoc = new FollowerDoc()
    this.schemaError = null
    this.lastAppliedResetSeq = null
  }

  /**
   * `ok: true` confirms the subscription but does not mean its catch-up update
   * has already been integrated. The host sends `doc_subscribed(seq=N)` and
   * THEN `doc_update(seq=N)` — and sends no catch-up at all when the follower
   * was already current — so recording N as the applied baseline drops the
   * snapshot as stale and leaves a fresh follower empty (the KA-11
   * `schema_version=undefined` symptom). The ack seq is kept apart in
   * {@link ackSeq}: it arms the gap detector and backs {@link lastSequence},
   * but only an applied update ever moves {@link lastSeq}. The ack therefore
   * never rewinds a baseline established by an update that arrived first.
   *
   * `ok: false` means the server refused: clearing REALITY re-opens
   * the intent/reality disagreement so the next `reconcile()` (any status
   * frame) retries, instead of the bridge holding a subscription that does not
   * exist server-side and going silently deaf.
   */
  private readonly onDocSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const subscribed = event.detail as DocSubscribed
    if (subscribed.workflowId !== this.sentWorkflowId) return
    if (subscribed.ok) {
      this.ackSeq = subscribed.seq ?? null
      this.catchUpPending = this.ackSeq !== null
    } else this.sentWorkflowId = null
    const generation = this.resolveAckGeneration({
      workflowId: subscribed.workflowId,
      seq: subscribed.seq,
      ok: subscribed.ok
    })
    this.dispatchEvent(
      new CustomEvent(event.type, {
        detail: { ...event.detail, generation }
      })
    )
  }

  /**
   * This ack's send-to-response identity: see `pendingGenerations`'s and
   * `lastConsumptionHadNewerSend`'s doc comments for why a duplicate of the
   * ack just consumed is never dequeued — and instead repeats the same
   * generation rather than stealing the next one's barrier — while a
   * genuinely distinct ack always dequeues the oldest outstanding send,
   * never `subscribeGeneration` read here at receipt.
   */
  private resolveAckGeneration(identity: {
    workflowId: string
    seq: number | undefined
    ok: boolean
  }): number {
    const isDuplicateOfLastConsumed =
      this.lastConsumedAckIdentity !== null &&
      this.lastConsumptionHadNewerSend &&
      identity.workflowId === this.lastConsumedAckIdentity.workflowId &&
      identity.seq === this.lastConsumedAckIdentity.seq &&
      identity.ok === this.lastConsumedAckIdentity.ok
    if (isDuplicateOfLastConsumed) return this.lastConsumedGeneration
    const generation =
      this.pendingGenerations.shift() ?? this.subscribeGeneration
    this.lastConsumedAckIdentity = identity
    this.lastConsumedGeneration = generation
    this.lastConsumptionHadNewerSend = this.pendingGenerations.length > 0
    return generation
  }

  private readonly forwardFrame: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
  }
}
