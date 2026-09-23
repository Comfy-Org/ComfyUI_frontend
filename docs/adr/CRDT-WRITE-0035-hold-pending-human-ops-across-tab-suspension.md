# ADR-CRDT-WRITE-0035: Hold Pending Human Ops Across a Tab Suspension

Date: 2026-09-19

## Status

Proposed

## Context

The human write leg (`opSender`) mints each batch against the workflow the
follower is subscribed to and re-reads that subscription before every send. A
batch whose workflow is no longer the subscribed one settles `unconfirmed` if
already transmitted, or `undeliverable` otherwise. It is never re-addressed,
which is what keeps one workflow's ops out of
another workflow's document
([CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md),
`crossWorkflowPending.test.ts`).

Switching editor tabs does not rebind the agent session; it only pauses the
subscription. The follower treated that pause like a lost subscription: it
aborted the in-flight batch and the queued batches behind it. A `delete_node`
queued behind an in-flight edit when the tab switched was dropped without ever
reaching the host, and nothing surfaced the drop. On return, the follower
rebinds its adapter session and the first frame runs a full document-to-store
reconcile. The document still held the node, so the reconcile re-added its
record and the materializer recreated the node the user had deleted.

Two forces constrain the fix. The never-retarget rule must survive: a batch
may be delayed, never re-addressed. The reconcile must keep treating the
document as authoritative for everything except the human's own edits that the
host has not yet confirmed; removing the rebind reconcile would mask the
dropped write and change the follower's state seam.

## Decision

Distinguish a paused subscription from a lost one, and hold rather than drop.

- `opSender` gains idempotent `suspend()` and `resume()`. While suspended,
  `transmit()` parks a batch instead of sending or settling it; a batch that
  was already sent keeps its result timer, so a late result still settles it.
  `resume()` re-transmits only a parked batch; the transmit-time subscription
  check is unchanged, so a batch whose workflow is no longer subscribed still
  settles `unconfirmed` if transmitted or `undeliverable` otherwise.
  `abortIfUnbound()` keeps its meaning as the hard
  abort for a refused subscription or a real retarget.
- `useAgentCrdtFollower` suspends the sender only when the tab of the workflow
  it is bound to goes inactive, and remembers that workflow. A rebind to
  another workflow, or a real detach, still aborts at once. On the active edge
  the follower skips the abort for the remembered workflow and resumes once
  the subscribe has actually left the transport, either synchronously or from
  the later `doc_subscribed` acknowledgement; a refusal still aborts.
- `opSender` exposes `pendingOps()`; `EcsFollowerAdapter` takes an optional
  `LocalIntent` port and its full reconcile skips a document node with a
  pending human `delete_node`, including that node's incident links, so the
  batch still commits. The port is the seam a pending `add_node` guard plugs
  into.
- Retained delete intent lives in a `PendingDeleteRetentionStore`
  (`pendingDeleteRetentionStore.ts`), injected into `useAgentCrdtFollower`
  rather than owned by the follower it backs. A follower instance is
  disposed and replaced more often than the intent it should keep suppressing
  survives for: the `productGate` toggle recreates one internally, and the
  docked agent panel closing and reopening recreates the composable call
  itself. Production shares one eagerly-created instance
  (`sharedPendingDeleteRetentionStore`) across every follower
  `AgentPanelRoot.vue` creates, so a delete retained by a disposed follower
  still suppresses resurrection on a freshly mounted one's very first
  reconcile; tests inject a fresh store per case instead.
- `opSender` captures opaque per-op `admissionMetadata` at admission time,
  when the op's `op_id` is minted - before the op reaches the wire, and
  therefore before any `doc_update` can react to it - but the sender itself
  neither recognizes `delete_node` nor knows what the metadata means; only
  the retention coordinator's own callback does, reading a `delete_node`'s
  target identity (the Yjs `client:clock` occupying that node id) and
  returning null for every other op. This keeps transport batching and retry
  independent of Yjs/delete policy: a future caller can carry its own
  opaque value through the same seam without opSender changing. A doc-diff-
  based capture (observing the id disappear from the document) cannot do
  this safely: a delete and a same-id recreate arriving in one atomic Yjs
  transaction never shows up as a removal in that diff, so a doc-diff
  capture has nothing to attribute a later settle to and falls back to
  reading whatever identity is current - the newly recreated one, not the
  deleted one. The metadata is stored keyed by that exact `op_id` and handed
  back on the batch's `BatchOutcome` (`admissionMetadata`), so a settling
  batch binds each `delete_node` op to the identity captured for THAT op,
  never to a position in a shared queue.
- The retention policy is a state machine keyed by how a `delete_node` op
  settled and whether an identity was captured for it, not something to read
  off the Consequences section below. A `docNodeIds` read is `authoritative`
  only once the follower's bound document has produced its own frame since
  last being (re)bound and that read itself succeeded; the transient empty
  snapshot between a lineage replacement and that document's own catch-up
  frame is not, an unreadable snapshot (an internal Yjs-shape break) is not
  either, and neither may release a retention on the strength of the
  document appearing to no longer hold the node (see `useAgentCrdtFollower.ts`'s
  `docCaughtUp` and `readDocNodeIds`). Every rule below that turns on the
  document's own contents applies only to an authoritative read:
  - `confirmed-applied`, with a captured identity (`acknowledged`, the op id
    is in `applied`): retained until an authoritative read shows the
    document no longer holds the node, or a different Yjs item identity now
    occupies that node id. No expiry - the outcome is already certain.
  - `confirmed-applied`, with no captured identity: the op's target did not
    yet exist in the follower's own doc at admission time (typically a
    locally-added node whose `add_node` had not yet reached this doc), so
    there is nothing to compare a later occupant of the id against. Without
    that comparison, "the document still holds the deleted node" and "a
    different item now occupies that id" are indistinguishable, so this is
    bounded by the same expiry as `unknown` instead of held forever - an
    unbounded, identity-less record would risk suppressing an unrelated
    later node at that id indefinitely.
  - `unknown` (`unconfirmed` or `unacknowledged`): retained under the same
    document-agrees release condition, plus a bounded expiry
    (`PENDING_DELETE_EXPIRY_MS`, reusing `STALE_AFTER_MS`) that releases it
    on its own if the document never agrees.
  - `undeliverable`, and `acknowledged` with the op id in `skipped`: never
    retained. The transport never carried the op, or the host explicitly
    rejected it, so there is no delete to protect from resurrection.
- `follower_replaced` alone never clears a workflow's retained deletes -
  among follower-replacement events, only `doc_reset` does (whose handler
  runs first and always precedes `follower_replaced` for a true lineage
  break). `follower_replaced` also fires, with no preceding `doc_reset`, on
  an ordinary local switch to a DIFFERENT workflow's lineage
  (`LayoutFollowerBridge.subscribe`); clearing retention there would erase a
  destination workflow's already-confirmed delete before its first
  post-switch reconcile can consult it, on nothing more than the coincidence
  of revisiting a workflow that was active before.
- Separately, a signed-in principal or active workspace teardown clears
  EVERY workflow's retained deletes (`clearAll()`, reported to the shared
  store by `AgentPanelRoot.vue` resolving a new scope) - a retention
  confirmed under one principal or workspace must never leak into the next
  one's session. This is independent of the follower-replacement events
  above: it fires on an identity/workspace change alone, whether or not any
  follower is replaced at the same time.

Alternatives considered:

- Drain before unsubscribing. Keeps the subscription alive until the sender
  empties. Closes the same hole for the common case but needs a cancellable
  deferral inside the watcher and a bounded wait; it can be layered on later.
- A retry queue that resends `undeliverable` ops when the workflow rebinds.
  Duplicates the sender's ordering and never-re-mint rules outside the module
  that owns them.
- Not arming the reconcile on a same-lineage rebind. Hides the symptom while
  the host document stays wrong and removes the safety net that realigns the
  stores after a tab's serialized state rehydrates them.
- Wiring `pendingOpLedger` as the intent source now. That wiring is in flight
  elsewhere; the port lets it replace the sender-derived set without touching
  the adapter.

## Consequences

### Positive

- A human delete made moments before a tab switch reaches the host once the
  tab returns; the canvas and the document converge instead of diverging.
- The rebind reconcile no longer resurrects a node the user deleted while the
  delete is still in flight. This half is load-bearing: a host that withholds
  the result for an unsubscribed tab leaves the pre-switch batch to the
  result-silence resend, so the held delete can trail the return by tens of
  seconds.
- The never-retarget invariant and its tests are untouched.
- Retained delete intent survives the agent panel closing and reopening (and
  the product-gate toggle recreating a follower internally): the reconcile
  that runs on a freshly mounted follower's very first frame still sees a
  delete retained by the follower it replaced, instead of resurrecting the
  node before that follower has any state of its own.

### Negative

- Parked ops (the sender's own in-flight/queued batches) live in memory until
  the tab returns, the session retargets, or the follower is torn down; they
  die with the page or when the panel unmounts. Retained delete intent is
  the exception, per the positive consequence above: it lives in the
  injected store, not the follower, so it outlives that teardown.
- The eager abort on a null subscription is kept for the refusal path, so a
  refused resubscribe on return still drops the held batch.
- A delayed batch carries the `base_version` it was minted with. The applier
  orders a delete against the node's stamp, so a node another actor touched
  at a higher version while the tab was away can win and the delete is
  dropped as `lww-dropped`; the follower then converges to the host's view.
- The incremental frame path still upserts a pending-deleted node when another
  actor edits it before the delete lands; only the full reconcile consults
  local intent.
- A bounded retention (`unknown`, and `confirmed-applied` with no captured
  identity) suppresses its node for up to `PENDING_DELETE_EXPIRY_MS` even
  when the delete never actually reached the host, so a node a lagging
  reconcile would otherwise restore stays hidden past the doc's own answer
  for that window. `undeliverable` deletes get no suppression and no
  feedback that the delete was lost; immediate catch-up and lost-write
  feedback for a genuinely lost `undeliverable` delete remain follow-up work.

## Notes

The backend can also re-project a document over a human draft at turn start;
that is a separate, per-turn cause of the same symptom, tracked internally.
