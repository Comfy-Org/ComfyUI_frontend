import type {
  DocFrameClient,
  DocOp,
  DocReset,
  DocSubscribed,
  DocUpdate
} from './docFrameClient'
import { FollowerDoc } from './followerDoc'
import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

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
    console.warn('[agent-crdt] outbound doc frame dropped', error)
    return false
  }
}

/**
 * Bridges server doc frames to the follower's semantic {@link FollowerDoc} and
 * re-dispatches them. It does NOT touch the layout store: the semantic doc is
 * projected into the canvas by `SemanticProjector` (ADR-009). Applying the raw
 * semantic update into `layoutStore` was the original render bug — both docs
 * expose a root map named `nodes`, so semantic entries corrupted the layout doc
 * and no node ever rendered.
 *
 * Subscription is modelled as INTENT reconciled against transport REALITY, and
 * teardown is failure-tolerant; see the two id fields and {@link destroy}.
 */
export class LayoutFollowerBridge extends EventTarget {
  /**
   * Reassigned only by {@link onDocReset}: a lineage break replaces the doc
   * wholesale, because folding a re-minted document into the old one merges
   * two unrelated histories and duplicates every node on the canvas.
   */
  private followerDoc = new FollowerDoc()
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
   * Highest doc seq seen since the last subscribe left the transport; `null`
   * until the first post-subscribe frame, so catch-up re-baselines instead of
   * being compared across a resubscribe. See the gap detector in
   * {@link onDocUpdate}.
   */
  private lastSeq: number | null = null

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

  subscribe(workflowId: string): void {
    this.desiredWorkflowId = workflowId
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
      trySend(() => this.client.unsubscribe(sent))
    }
    if (desired === null || this.sentWorkflowId === desired) return
    if (
      trySend(() => this.client.subscribe(desired, this.follower.stateVector()))
    ) {
      this.sentWorkflowId = desired
      this.lastSeq = null
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
   * remote updates into a projector still wired to the live canvas.
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

    // Seq is the contract's gap detector (crdt.go): the pub/sub relay is
    // best-effort, so a jump means a frame was dropped — possibly a
    // `doc_reset`, in which case these bytes belong to a NEW lineage and
    // folding them in duplicates the canvas. The frame is therefore NOT
    // applied; resubscribe() keeps this FollowerDoc and its state vector so
    // the ordinary catch-up delivers everything missed.
    if (this.lastSeq !== null && update.seq > this.lastSeq + 1) {
      this.resubscribe()
      return
    }
    if (this.lastSeq === null || update.seq > this.lastSeq)
      this.lastSeq = update.seq
    this.follower.applyRemoteUpdate(update.update)

    // KA-11 read-time gate. The merge itself is unconditional — Yjs bytes are
    // integrated or they are not — but nothing downstream may READ a doc whose
    // declared schema this build was not written against. Failing closed here,
    // before the frame is re-dispatched, is what keeps a v2 doc from being
    // half-projected onto the canvas by a v1 reader.
    try {
      assertReadableSchema(this.follower.doc)
    } catch (error) {
      if (!(error instanceof FollowerSchemaError)) throw error
      this.schemaError = error
      this.dispatchEvent(
        new CustomEvent('schema_error', {
          detail: { workflowId: update.workflowId, found: error.found }
        })
      )
      return
    }

    this.dispatchEvent(new CustomEvent('doc_update', { detail: update }))
  }

  /**
   * Lineage break (`doc_reset`): the host re-minted the document, so nothing
   * already held composes with what comes next. Resync is a FOLD — folding a
   * re-minted lineage into the old doc duplicates the canvas — so the doc is
   * dropped wholesale and the fresh state is pulled through the ordinary
   * subscribe catch-up path: the recreated doc's state vector is empty, so the
   * resubscribe asks for the full folded state. The follower still never
   * writes (KA-6); a reset emits nothing but the resubscribe.
   */
  private readonly onDocReset: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const reset = event.detail as DocReset
    if (reset.workflowId !== this.sentWorkflowId) return
    // Consumers/projectors must observe the lineage break while their old
    // doc reference is still valid. Replacement is the final step of the
    // ordering barrier and is reserved for this explicit frame.
    this.dispatchEvent(new CustomEvent('doc_reset', { detail: reset }))
    this.followerDoc.destroy()
    this.followerDoc = new FollowerDoc()
    this.schemaError = null
    this.resubscribe()
  }

  /**
   * `ok: true` carries the seq of the catch-up snapshot — the gap detector's
   * baseline. `ok: false` means the server refused: clearing REALITY re-opens
   * the intent/reality disagreement so the next `reconcile()` (any status
   * frame) retries, instead of the bridge holding a subscription that does not
   * exist server-side and going silently deaf.
   */
  private readonly onDocSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const subscribed = event.detail as DocSubscribed
    if (subscribed.workflowId === this.sentWorkflowId) {
      if (subscribed.ok) this.lastSeq = subscribed.seq ?? null
      else this.sentWorkflowId = null
    }
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
  }

  private readonly forwardFrame: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    this.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }))
  }
}
