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
  batch still commits. An acknowledged delete stays pending until the document
  no longer holds the node. The port is the seam a pending `add_node` guard
  plugs into.

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

### Negative

- Parked ops live in memory until the tab returns, the session retargets, or
  the follower is torn down; they die with the page or when the panel
  unmounts.
- The eager abort on a null subscription is kept for the refusal path, so a
  refused resubscribe on return still drops the held batch.
- A delayed batch carries the `base_version` it was minted with. The applier
  orders a delete against the node's stamp, so a node another actor touched
  at a higher version while the tab was away can win and the delete is
  dropped as `lww-dropped`; the follower then converges to the host's view.
- The incremental frame path still upserts a pending-deleted node when another
  actor edits it before the delete lands; only the full reconcile consults
  local intent.
- Retained delete intent (`useAgentCrdtFollower`'s per-workflow
  `confirmedDeletes`) is not one policy - the retained reason matters, not
  just whether a node id is in the set. An `acknowledged` result naming the
  op `applied` is definitive: the host processed it, and only its own
  removal effect frame lagging behind is left, so this reason stays pending
  until the document itself no longer holds the node - no other exit,
  because the outcome is already known and the lag is not bounded. Terminal
  `unacknowledged` or `unconfirmed` deletes are the opposite: the transport
  carried the batch at least once, so the host may have applied it even
  without a confirming result, but nothing here certifies that it did.
  These retain the same document-agrees exit, plus a hard expiry
  (`PENDING_DELETE_EXPIRY_MS`, reusing the channel's own `STALE_AFTER_MS`
  recency budget) that releases on its own if the doc never agrees - no
  frame in this doc-sync system certifies "the host's answer to this
  specific op is now settled" sooner. Applying that same expiry to the
  `acknowledged` reason was tried and was wrong: a definitive delete whose
  removal effect frame lags past the expiry would get pruned while the doc
  still (correctly, if slowly) held the node, resurrecting it on the next
  reconcile - the failure this ADR exists to prevent. `undeliverable`
  deletes are excluded from retention entirely: the transport never carried
  them, so there is no evidence this specific delete was applied - that says
  nothing about whether some other actor or operation deleted the node by
  other means, so retaining one on that basis alone would hide its node
  forever, not for a bounded window. Immediate catch-up and lost-write
  feedback for a genuinely lost `undeliverable` delete remain follow-up
  work; unknown outcomes are not hidden indefinitely.

## Notes

The backend can also re-project a document over a human draft at turn start;
that is a separate, per-turn cause of the same symptom, tracked internally.
