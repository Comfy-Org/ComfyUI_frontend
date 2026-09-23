# ADR-CRDT-RECONCILE-0035: Local-Only State Survives Authoritative Reconcile

Date: 2026-09-19

## Status

Proposed

## Relationship to existing ADRs

Reconnect, replay and queued human ops already have a design; this record is
the follow-up [CRDT-WRITE-0035](CRDT-WRITE-0035-hold-pending-human-ops-across-tab-suspension.md)
itself names as future work ("immediate catch-up and lost-write feedback
remain follow-up work"). It decides only what those records leave open.

- **[CRDT-WRITE-0035](CRDT-WRITE-0035-hold-pending-human-ops-across-tab-suspension.md)**
  decides that a tab-inactive suspension parks `opSender` instead of dropping
  it, and that a full reconcile after return must skip a document node with a
  pending human `delete_node`. It explicitly defers immediate catch-up and
  lost-write feedback, and the ledger wiring behind `pendingHumanDeletes()`.
  This ADR supplies both: the pending-op ledger as the sole source of that
  intent, and the catch-up barrier that resolves what suspension left
  unresolved.
- **[CRDT-FOLLOWER-0035](CRDT-FOLLOWER-0035-bounded-ack-timeout-retry-for-unacknowledged-doc-subscribe.md)**
  decides bounded resubscribe retry on an unacknowledged `doc_subscribe`,
  same-lineage and same state vector. This ADR adds the subscribe-generation
  dedup that keeps a delayed or repeated ack from being consumed as a second
  barrier, and the reactivation-continuity check that runs once an ack is
  consumed.
- **[GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)**
  decides that ordinary recovery is same-lineage state-vector replay and that
  only a host `doc_reset` may replace the follower doc. This ADR treats a
  repeat delivery of the same reset as a no-op and decides what happens to
  local-only state and pending intent across that lineage boundary.
- **[CRDT-PENDING-0030](CRDT-PENDING-0030-pending-op-reverts-undo-optimistic-canvas-state.md)**
  decides that a host-rejected `add_node` is reverted off the canvas and that
  `unconfirmed` (delivery unknown) does not itself trigger a revert. This ADR
  decides what happens to an entry `unconfirmed` leaves open: it parks as
  `delivery_unknown` and resolves at the next same-lineage catch-up, by a
  type-correlated rule that reverts only when the document does not hold the
  entry's id.
- **[CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)**
  decides the one-way follower boundary (raw updates flow host to follower
  only) and that the optimistic overlay clears on effect, not on ack. This
  ADR fills in the "echo-attribution" and "optimistic overlay" gaps that
  record leaves open: how an echo of the page's own accepted add is told
  apart from a genuine id collision.
- **[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md)**
  decides that a human-authored draft can reset the shared document
  server-side, and that a resulting `doc_reset` settles the sender's queued
  and in-flight batches. This ADR's lineage-break handling (a mismatched
  reactivation invalidates conservatively) is the client-side complement.

## Context

Human canvas edits reach the shared semantic document optimistically: the
LiteGraph mutation lands locally first, the mint ports turn it into a wire op,
and `opSender.ts` carries it to the doc host, which the follower then treats
as authoritative. Two gaps in that loop are not covered by the ADRs above and
motivate this record, confirmed by reading current `main` and the repros in
[#18078](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18078) and
[#18063](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18063):

1. **The echo of the page's own accepted add arms a full reconcile.** The
   host fans the accepted batch back as a `doc_update`; the incremental path
   calls `batch.addNode` for the `add` action and `prepare()` rejects it with
   `node id N is already registered`. The failed batch sets
   `reconcileNextFrame = true`, so the frame after every accepted human add is
   a full reconcile during ordinary editing. The relay's `doc_update` carries
   `actor` and `seq` but no op ids, so the follower cannot recognise its own
   echo by op identity today.
2. **A human-inserted subgraph blueprint carries no definition into the
   document.** The pinned `@comfyorg/comfy-multi-player@0.2.1` vocabulary has
   no `define_subgraph`. The human insert path
   (`LGraphCanvas._deserializeItems` to the layout mint port) mints only an
   `add_node` typed by a definition id the document has never seen. The host
   survives (#18078), but the agent cannot see inside it.

The remaining gap the earlier draft of this ADR covered — a host-rejected op
being swallowed, and the first frame after a follower rebind deleting local
nodes the document lacks — is CRDT-WRITE-0035's and CRDT-PENDING-0030's
decision, not this one's; see Relationship above for what each already
settles and what this record adds on top.

#18078 removes the trigger for the reported node classes by keeping positional
`widgets_values` for `isVirtualNode` classes in `serializeForMint`. It does not
touch either gap above. This ADR decides how the layer behaves so that
local-only state is never again deleted silently, and how the work is cut so
it does not collide with the open PRs already editing the same files.

## Decision

The document stays authoritative for what it has seen. It is not authoritative
for what it has never been told about. Concretely:

### (a) Rejected and unresolved human ops: the ledger, longer-lived, plus the catch-up barrier

The pending-op tracker (CRDT-PENDING-0030) is the ledger of record; this ADR
does not re-decide its revert-and-toast mechanics. It adds one state,
`delivery_unknown`, for parked entries, and decides the following deltas,
landed in PR A:

- **The ledger is owned per bound workflow/document, not per follower
  mount.** #16309's ledger resets on tab deactivation, which is not enough on
  its own: `useAgentCrdtFollower` constructs the tracker's seam
  (`createOpSender`) inside an effect scope owned by `AgentPanelRoot`, and an
  ordinary panel close or mode change tears the tracker down with it — that
  is not a lineage break. After a remount on the same workflow, a pending
  `delete_node` has no ledger entry, so catch-up can silently restore the
  node the user deleted. The ledger instead lives in a registry keyed by the
  bound workflow/document's lineage id: created on first bind, independent of
  any one follower mount, and cleared only on an actual lineage break (reset,
  replace, workflow close, or explicit destroy) — never on panel close or a
  mode change alone. This lands in two steps: PR A keeps the ledger inside
  the follower and closes only the tab-deactivation gap; PR A1 hoists its
  ownership to workflow/document scope, and this ADR's guarantee does not
  hold for panel close/reopen until A1 lands. `createOpSender`'s `detach()`
  drops in-flight batches without settling them, so PR A also makes the
  follower call `abortAll()` before `detach()`: queued and open batches
  settle `undeliverable` and an in-flight one settles `unconfirmed` (parked,
  resolved at the next barrier). The registry drops a lineage when its
  workflow closes, so it cannot grow without bound.
- **The ledger is the only source of pending-delete intent.**
  `pendingHumanDeletes()` becomes a read over the ledger: a `delete_node` in
  any non-terminal state, including `applied` until its effect frame lands,
  is a pending delete. This is the wiring CRDT-WRITE-0035 defers, and it
  replaces the two-sources-that-can-disagree shape #18078 left behind.
- **`unconfirmed` joins `unacknowledged` in the parked set, and parking has a
  deadline: the catch-up barrier.** Both mean the host may have applied the
  batch. Parked entries enter `delivery_unknown` and resolve at the first
  authoritative frame the follower applies after (re)binding the same
  lineage, or, when the resubscribe finds the state vector already current
  and no frame follows, the `doc_subscribed {ok:true}` ack itself. Resolution
  is per kind, evaluated against the document as of the barrier:
  `add_node`, the node id is present and the document node's type equals the
  ledger entry's minted type; `delete_node`, the id is absent; `connect`, the
  link id is present; `set_widget` clears unconditionally at the barrier
  (last-writer-wins makes whatever value the document holds a valid
  outcome); `clear` is not parked. Present-and-same-type clears the entry.
  Absent reverts it (an `add_node` removes the node, other kinds toast only)
  — **the revert removes a node only when the document does not hold its
  id**, so it can never delete an authoritative node. Present-but-different-
  type is an id collision, handled as (c) handles it. Nothing is
  re-enqueued.
- **The ack-as-barrier path is gated by subscribe-generation dedup, and, on a
  reactivation, by continuity with what was last projected.** The transport
  can re-deliver a successful `doc_subscribed` ack for one logical
  (re)subscribe, so the client tracks a per-session counter that advances
  once per subscribe frame it actually sends and tags it onto every ack for
  that outstanding subscribe; only the FIRST ack naming a given counter value
  is consumed as a barrier — a later ack naming an already-consumed
  generation is a no-op, the same idempotency `layoutFollowerBridge.ts`
  applies to a repeat delivery of the same `doc_reset` (identical seq, same
  lineage). This same-session counter cannot by itself prove an ack belongs
  to this client's own history rather than to a document the host silently
  reminted under the same workflow id while the tab was away — that needs a
  backend wire change (a per-lineage generation or reset counter on
  `doc_subscribed`/`doc_reset`), which this frontend-only PR does not have
  and does not decide. Pending that dependency, a resubscribe that follows a
  paused (tab-inactive) subscription checks continuity instead: the resume's
  ack `seq` equal to what this client last projected means the document did
  not change while away, so the barrier runs unchanged. A different `seq`
  there is "continuity unknown, not disproven": the client conservatively
  invalidates — every parked entry reverts now, as if its effect were
  absent, and every batch the sender still holds settles — **before** the
  known-id sweep in (b) runs, so a settlement the invalidation itself just
  parks cannot survive as a stale-lineage entry the sweep never saw. Outside
  a reactivation, a `seq` mismatch is left alone: the natural catch-up frame
  is trusted to resolve things through the ack-as-barrier path's own
  per-kind rules. This mitigation is accepted as incomplete: it protects the
  ledger from a reactivation it cannot vouch for, but it cannot repair
  whatever the Yjs document itself does when a stale state vector is sent
  against a silently reminted lineage — tracked as a followup, not resolved
  here.
- **Per-frame order is fixed: resolve, apply, clear.** For each
  authoritative frame the follower (1) resolves parked entries against the
  document state the frame produces and marks them terminal, (2) applies the
  frame's projection with the ledger as it stands after step 1, so (b)'s
  pending-delete filter no longer hides a node whose delete just reverted
  and (c)'s echo gate still sees the `add_node` entry the frame echoes, then
  (3) clears the entries whose ack seq the frame's `seq` covers. Clearing
  before applying would strip the echo gate's entry in the very frame that
  echoes it and misreport every accepted human add as a collision.
- **Every host rejection is reported**, additionally, with a stable
  `errorType` (`agent_crdt_human_op_rejected`) and the host's failure code, op
  kind and node id in context, never the payload.
- **Clearing without op ids is seq-based.** Every `doc_update` and
  `doc_ops_result` carries the workflow's monotonic `seq`; an applied entry
  clears when the follower projects a seq at or after its ack seq. The hole:
  the host's `applied` list includes `lww-dropped` and delete-wins `no-op`
  outcomes, so an op that never took effect clears as applied and stays
  divergent, unreported. Closing that needs a per-op-outcome host frame
  upgrade, named in `opSender.ts`'s header comment and not owned here.

For #18063's shape (a `delete_node` still queued when the tab switches) this
means: the delete is parked, (b) keeps the node out of the reconcile upsert
while it is parked, and if the host still holds the node after the catch-up
barrier the delete reverts and the toast fires.

### Durable guarantee vs. interim mechanism

Four behavior requirements are durable and should outlive any one mechanism
below: an unresolved human intent is never silently discarded by a reconcile;
a host rejection is reported; an outcome whose delivery is unknown resolves at
the next same-lineage catch-up barrier rather than left ambiguous
indefinitely; and any collision the available provenance can identify is
reported, with the document winning. Provenance today is op-identity-based
(the ledger's `add_node` entry for a node id, in a state the host can have
echoed): a same-type, same-id replacement under an add that never reached the
ledger converges silently, without a report — the negative consequence
recorded below.

| Requirement                                                                                                            | A                     | A1                    | B                                                  | C                          |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------- | -------------------------------------------------- | -------------------------- |
| Unresolved intent survives a reconcile (queued/in-flight never discarded)                                              | tab-deactivation only | + panel close/reopen  | + lineage-aware `removeMissing`/orphan sweep       | —                          |
| A host rejection is reported                                                                                           | yes                   | yes                   | yes                                                | —                          |
| Delivery-unknown resolves at the next catch-up barrier (or, after a reactivation, only once continuity is established) | yes                   | yes                   | yes                                                | —                          |
| An identifiable collision is reported, not resolved silently                                                           | incremental path only | incremental path only | + full-reconcile path, once the known-id set lands | —                          |
| Blueprint definitions reach the document                                                                               | —                     | —                     | —                                                  | blocked (see Dependencies) |

A blank cell means that slice does not change the requirement's status from
the slice before it; "—" means the slice does not touch that requirement.

That whole mechanism is interim. A proposed semantic-apply direction (store-
first projection replaced by semantic `LGraph`/`LGraphNode` apply with
call-carried provenance), if adopted, deletes the parallel pending ledger
itself: a command-minted operation already carries its own identity, so
satisfying the same four requirements would use command-carried provenance
plus ingress echo filtering instead of a separate ledger lookup. Adopting
that direction is out of scope here and not decided by this ADR. If adopted,
`removeMissing`'s ledger- and lineage-awareness, `reconcileNode`,
`reconcileNextFrame`, the materializer's repair pass, the ledger-gated echo
check in (c), and `pendingOpLedger.ts` itself are deleted or replaced, not
amended; the four requirements above are what must keep holding across that
change.

### (b) `removeMissing` and the orphan sweep are ledger-aware and lineage-aware

Both scopes apply; neither alone covers the two repros.

- **Ledger-aware.** A node with an `add_node` in any non-terminal ledger
  state is retained by `removeMissing` and by the materializer's orphan
  sweep; a node with a non-terminal `delete_node` is not re-created by a
  reconcile upsert. This is the "lineage-aware retention of pending intent
  through a full reconcile" requirement: it keeps #18063's deleted node
  deleted and #18078's never-landed node alive until the ledger resolves. A
  widget with a non-terminal `set_widget` keeps its local value through a
  full reconcile the same way.
- **Lineage-aware, deferred to PR B.** The session will keep a lineage-scoped
  **known-id set** in the same registry as the ledger: the node and link ids
  the document holds now, plus ids it held whose removal `removeMissing` has
  not yet applied locally. An id will leave the set only when a local sweep
  has removed it, never merely because the document dropped it, so
  `removeMissing` will remove exactly the ids in the set the document no
  longer holds. An id the document never held will be retained and reported
  once per session (`reportError`, `agent_crdt_local_only_node_retained`).
  **Not landed yet**: PR A's `ecsFullReconcile.ts` still reads its node list
  live off the document's own map on every reconcile (see (c) below), and
  the composable's own `knownDocNodeIds` is only a dev-panel event tap, not
  this set. Per Sequencing below, PR B (which introduces this set) comes
  after A1, so the set is introduced already at the ledger's post-A1
  workflow/document lifetime — there is no separate per-follower phase for
  it to outgrow.

The genuine "stale local canvas" case is a lineage break: `doc_reset` and
`follower_replaced` already run `clearForReset` plus the sweep, unchanged by
this ADR, and remain the only path that may delete state the document never
held.

### (c) An echo of an own add is a reconcile; any other collision is reported

The adapter treats an `add` action whose node id is already registered in the
store as the echo of an own add (`reconcileNode`, not `addNode`) only when the
ledger holds an `add_node` for that node id, **of the same type**, in a state
the host can have seen: `inflight`, `applied` or `delivery_unknown`. A
`queued` or `unprocessed` entry has never reached the host and cannot have
produced an echo, so an incoming add under its id is a collision
(`agent_crdt_node_id_collision`). **This classification is not yet run in the
full-reconcile path** — `applyFullReconcile` reads its node list live off the
document's own map on every reconcile, so "already registered locally" is
true for every ordinarily-synced node, not only a colliding local-only one,
and telling those apart needs (b)'s known-id set. **This collision
classification is therefore deferred to PR B**, alongside the known-id set it
depends on; (b)'s ledger-aware retention still holds on the rebind path, but
a same-id collision there converges silently until PR B lands (see
Consequences/Negative). The ledger survives deactivation per (a), so the echo
case on the incremental path is always covered. A collision is a retained
local-only node and a document node minted under the same graph-local
integer. The adapter reports it and shows the same toast a revert gets. The
document wins by an explicit replace, `deleteNode` then `addNode` under
`layoutStore.withActor` with mint ports suppressed, whatever the types:
`prepare()`'s `reconcileNode` picks `replaceNode` only when the types differ
and merges same-type nodes, which would leave the retained local node's links
and widget identity in place.

### (d) Blueprint definitions: mint `define_subgraph` on the human insert path

The frontend cannot fix this gap alone. When the human insert path
(`_deserializeItems`, subgraph blueprint drop or paste) creates a definition
the bound document lacks, the layout mint port emits `define_subgraph` for
that definition (nested definitions first) ahead of the host's `add_node`, in
mint order, so the applier registers the type before the node that uses it.
This requires the package-integration chain detailed in Rollout status;
nothing in PR A, A1 or B depends on it. Until it closes, the host lands as an
opaque positional node (#18078) and the port reports once per definition id
(`agent_crdt_blueprint_definition_not_in_doc`).

## Alternatives considered

- **Re-enqueue held ops when the same workflow rebinds.** Rejected. Nothing
  discriminates a tab-switch `undeliverable` from a retry-budget or no-doc
  one; a re-applied `add_node` is not idempotent against a changed document;
  no per-kind precondition was defined. The parked-then-verified path in (a)
  surfaces the same divergence without those risks.
- **Ledger-aware `removeMissing` only.** Misses an add whose batch was never
  minted and a node restored from `activeState` after a lineage reset emptied
  the ledger.
- **Lineage-aware `removeMissing` only.** Re-creates #18063's deleted node
  until the delete lands; the ledger is what says "local intent is deletion".
- **Treat every "already registered" add as a reconcile.** Would let a
  document node silently replace a retained local-only node with the same id
  once (b) starts retaining; hence the ledger gate in (c).
- **Re-mint the local node's id on collision (ADR-ECS-IDENTITY-0016).**
  Deferred: the pinned applier does not remap ids; revisit when it does.
- **Filter own echoes by `actor`.** A single frame folds agent and human
  effects; a per-frame skip drops agent effects.
- **Host-side definition registration on first sight of an unknown type.**
  Moves frontend definition data into the host through a side channel and
  bypasses the op log; rejected in favour of #17454's op.

## Sequencing

Five dependency-ordered slices, each landing its failing test first. No new
feature flag: the whole layer sits behind `agentPanelStore.enabled`, and is
not generally available; (b) and (c) fail safe by retaining more and
reconciling less. (a)'s revert applier is destructive when its resolution is
wrong and gets no kill-switch for the same reason; add a settings switch if
the layer reaches general availability before the revert path has soaked.

- **PR A0**, independent: closes the window in which a workflow load's first
  nodes mint into the previous document, by dropping and reporting a
  `createNode` whose graph is not the bound document's root graph. Dropped
  if its entry-condition test cannot be made to fail first.
- **PR A**, after #18071 and #16309: the (a) deltas and (c), with the ledger
  still owned inside the follower (survives tab deactivation, not yet panel
  unmount). Acceptance: a rejected human add is reverted and reported, an
  echo of the page's own accepted add reconciles instead of forcing a full
  resync, and queued and open batches settle before the sender detaches.
- **PR A1**, after A: hoists the ledger's ownership from the follower to the
  bound workflow/document. Acceptance: closing the panel with a pending human
  delete and reopening on the same workflow does not restore the deleted
  node. This ADR's guarantee does not fully hold until A1 lands.
- **PR B**, after A1 and after the retry-accounting decision on #16358: (b),
  ledger-aware and lineage-aware `removeMissing` and orphan sweep, plus the
  full-reconcile collision classification (c) defers. Acceptance: a node the
  user added whose `add_node` never reached the doc survives a tab-return
  reconcile, and a node the user deleted stays deleted across a tab switch
  even when the delete was still in flight.
- **PR C**, blocked on a new define_subgraph package-integration plan (see
  (d)); nothing in A, A1 or B waits on it.

The file/test-level rollout checklist for this stack (exact files touched,
test names, fixture wiring) is tracked outside this ADR. Server dependencies
named, not owned here: per-op outcomes on `doc_ops_result` or op ids on
`doc_update` (for effect-correlated clearing), and a per-lineage generation or
reset counter on the subscribe acknowledgement (for the reactivation-
continuity gap in (a) above). See "Rollout status" below for which open PRs
are in flight and their current state.

## Rollout status

This section, not the decision prose above, is where PR topology and dated
package/branch status are expected to need updating as the stack moves —
none of it changes the durable decision, invariants or dependencies recorded
above.

- **PR C's package-integration chain (blocks (d)).** The op itself was
  #17454's, stacked on the workspace-move PR #16644 (giving the frontend its
  own writable copy of `packages/comfy-multi-player`); both closed unmerged
  (#16644 on 2026-09-17, #17454 on 2026-09-22) — `main` still consumes the
  npm-published `@comfyorg/comfy-multi-player@0.2.1`, which has no
  `define_subgraph`. #17458, the frontend PROJECTION half, merged on
  2026-09-22 anyway: it reads the definition shape the op WOULD write
  directly off the raw Yjs doc, so it needed no runtime dependency on
  #17454, only shape agreement. PR C is therefore blocked on a narrower
  remaining gap than before: a live successor to the closed op PR that
  actually adds `define_subgraph` to the package this frontend consumes,
  plus the doc host admitting it from human actors — the host pins its own
  copy of the package separately, so a package release carrying the op is
  required regardless of which frontend copy this repo consumes.
- **PR A is
  [#18210](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18210)** (branch
  `claude/pending-op-tracker-survives-tab-switch`), implementing this ADR's
  (a)/(c) deltas on top of its stacked base. **PR A1 (hoisting the ledger's
  ownership from the follower to the bound workflow/document) remains
  pending** — #18210 keeps the ledger follower-scoped, which survives a tab
  switch but not yet a panel close/reopen; A1 is the next stacked PR.
  [#18106](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18106) is a
  documentation-only PR carrying this same ADR text byte-identically; it is
  not an implementation carrier for A or A1.

## Consequences

### Positive

- A rebind or catch-up barrier removes only state the document once held;
  local-only state is retained and reported. The one exception, an id
  collision under (c), is reported too.
- Ordinary editing stops arming a full reconcile on every accepted add, which
  also shrinks the blast radius of the sibling reconcile-overwrite bugs.
- The pending-op ledger becomes the single source of pending human-op intent
  that CRDT-WRITE-0035 and CRDT-PENDING-0030 left as two separate reads.

### Negative

- Retained local-only nodes are a visible divergence until the ledger
  resolves or the user acts; the report is the mitigation, not a fix.
- Edits made before the first `bind()` are never minted (the mint gate is
  closed until the tab is active and bound), so under (b) they are retained
  and reported forever instead of deleted on the first snapshot; never-minted
  deletes during a teardown window are re-added by the reconcile and seen by
  neither half of (b). The follow-up is an initial-sync mint of local-only
  state at first bind, or an explicit prompt.
- The known-id set and the longer-lived ledger add state that must reset on
  every lineage break; a missed reset retains stale state.
- Parking `delivery_unknown` entries until the next catch-up barrier delays
  the toast for a batch the host actually rejected while the tab was away.
- Seq-based clearing, like effect clearing, trusts an `applied` list that
  counts `lww-dropped` and `no-op`; until the host frame carries per-op
  outcomes some divergence stays unreported.
- The human-path `define_subgraph` mint is blocked on the (d) chain, so that
  gap keeps its interim behaviour for a while.
- The same-type, same-id collision under a never-landed add clears as an
  echo until `doc_update` carries op ids, on the full-reconcile path until PR
  B lands; the projection converges but the user's node has been replaced by
  the document's without a report.

## Notes

- ADR-ECS-0008: the ledger and the known-id set are plain data in
  adapter-owned modules; no methods are added to `LGraph`, `LGraphNode` or
  `LGraphCanvas`.
- ADR-CRDT-LAYOUT-0003: layout deletions still go through the layout store's
  command boundary.
- See Relationship to existing ADRs above for how this record composes with
  CRDT-WRITE-0035, CRDT-FOLLOWER-0035, GRAPH-DOCUMENT-0024,
  CRDT-PENDING-0030, CRDT-FOLLOWER-0025 and CRDT-AUTHORITY-0035.
