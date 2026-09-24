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
  intent, and the settlement rules (per-kind document presence, an explicit
  host rejection, or a bounded ledger terminal path) that resolve what
  suspension left unresolved.
- **[CRDT-FOLLOWER-0035](CRDT-FOLLOWER-0035-bounded-ack-timeout-retry-for-unacknowledged-doc-subscribe.md)**
  decides bounded resubscribe retry on an unacknowledged `doc_subscribe`,
  same-lineage and same state vector, and that a successful acknowledgement
  disarms that retry timer entirely. This ADR adds the settlement rules for a
  parked `delivery_unknown` entry — per-kind document presence, explicit host
  rejection, and a separate bounded terminal path the pending ledger owns for
  itself, since a `doc_subscribed` acknowledgement never settles an entry on
  its own — and the reactivation-continuity check that runs once a
  resubscribe's document state is available.
- **[GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)**
  decides that ordinary recovery is same-lineage state-vector replay and that
  only a host `doc_reset` may replace the follower doc. This ADR treats a
  repeat delivery of the same reset as a no-op and decides what happens to
  local-only state and pending intent across that lineage boundary.
- **CRDT-PENDING-0030** is stacked work open on
  [#16309](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16309), not yet
  landed on `main`, so it has no file under `docs/adr/` on this branch to
  link to; see that PR for the ADR text. It decides that a
  host-rejected `add_node` is reverted off the canvas and that `unconfirmed`
  (delivery unknown) does not itself trigger a revert. This ADR decides what
  happens to an entry `unconfirmed` leaves open: it parks as
  `delivery_unknown` and settles from per-kind document presence, an
  explicit host rejection, or a bounded ledger terminal path — never from a
  `doc_subscribed` acknowledgement alone — by a type-correlated rule that
  never reverts on absence: an id-matched entry that reads as absent stays
  parked until an explicit host rejection or the ledger's own bounded
  terminal path resolves it. See
  "Dependency contract" below for the revert, terminal-state and
  ledger-ownership semantics this record relies on, summarized so this ADR is
  reviewable while #16309 is still open.
- **[CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)**
  decides the one-way follower boundary (raw updates flow host to follower
  only) and that the optimistic overlay clears on effect, not on ack. This
  ADR fills in the "echo-attribution" and "optimistic overlay" gaps that
  record leaves open: how an echo of the page's own accepted add is told
  apart from a genuine id collision.
- **[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md)**
  decides that a human-authored draft can reset the shared document
  server-side, and that a resulting `doc_reset` settles the sender's queued
  and in-flight batches. This ADR's reactivation-continuity handling (a
  mismatched `seq` keeps parked entries parked, resolved by document check
  rather than reverted) is the client-side complement.

### Dependency contract (from CRDT-PENDING-0030, open in #16309)

Summarized from the linked ADR text above, since it is not yet on `main`:

- **Revert scope.** Only a host-rejected `add_node` is reverted; `connect`,
  `set_widget`, `delete_node` and `clear` are explicitly out of scope for
  `pendingOpRevert.ts` and stay that way ("do not grow ... into an
  inverse-operation framework").
- **Terminal state.** `unconfirmed` (delivery unknown) is not terminal and
  never itself triggers a revert; only an explicit host rejection does. The
  tracker keeps the pending entry and the sender keeps enough correlation to
  process a late result.
- **Identity, not a second ledger.** `createPendingRevertNodeRegistry`
  records the live `LGraphNode` at mint time; a rejection removes that exact
  object only. If the id has since been reused by another node, the handler
  leaves it alone — it never removes by node id.
- **Ledger ownership.** The pending-op ledger is kept, under the mechanism
  this ADR records, for operation identity, retries, acknowledgements, late
  results and authoritative-effect correlation. What must survive any future
  mechanism change is the requirement, not this artifact: see "Durable
  guarantee vs. interim mechanism" below for the mechanism-independent
  statement and the exact deletion list if the proposed semantic-apply
  direction is adopted — which deletes the ledger itself, not only the
  revert handler. The revert _handler_ (`pendingOpRevert.ts`) is
  narrowly-scoped canvas-compensation code, separate from the ledger either
  way.

This ADR's (a) builds directly on the terminal-state and identity rules
above: `delivery_unknown` is this record's extension of "`unconfirmed` does
not itself trigger a revert" to the parked-and-later-resolved case, and (a)'s
own never-revert-on-absence rule is the same protective shape as
CRDT-PENDING-0030's "leaves it alone" rule for a reused id — both act only on
positive evidence (an explicit rejection, or an identity match), never on
absence.

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
   document.** The consumed `@comfyorg/comfy-multi-player` package already
   exports `DefineSubgraphOp` and its applier already handles
   `define_subgraph`; the gap is frontend-only. `layoutMintPort.ts`
   mints `add_node`, `delete_node` and `clear`, and nothing else: it has no
   `define_subgraph` mint path. The human insert path
   (`LGraphCanvas._deserializeItems` to the layout mint port) therefore mints
   only an `add_node` typed by a definition id the document has never seen.
   The host survives (#18078), but the agent cannot see inside it.

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

### (a) Rejected and unresolved human ops: the ledger, longer-lived, plus bounded settlement

The pending-op tracker (CRDT-PENDING-0030) is the ledger of record; this ADR
does not re-decide its revert-and-toast mechanics. It adds `delivery_unknown`
for parked entries, plus two settlement outcomes for the cases an explicit
host rejection never resolves: `unresolved` (the ledger's own bounded
terminal path, non-destructive) and `abandoned` (target-session/document
destruction, also non-destructive). It decides the following deltas as a
proposed revision for the implementation carrier (PR A, and where noted PR
A1) to adopt — not yet reflected in that implementation:

- **The ledger is owned per bound workflow/document, not per follower
  mount.** #16309's ledger resets on tab deactivation, which is not enough on
  its own: `useAgentCrdtFollower` constructs the tracker's seam
  (`createOpSender`) inside an effect scope owned by `AgentPanelRoot`, and an
  ordinary panel close or mode change tears the tracker down with it — that
  is not a lineage break. After a remount on the same workflow, a pending
  `delete_node` has no ledger entry, so catch-up can silently restore the
  node the user deleted. The ledger instead lives in a registry keyed by the
  bound workflow/document's lineage id: created on first bind, independent of
  any one follower mount, and cleared only on an actual lineage break (reset
  or replace) or on the target session/document's own destruction — never on
  panel close, a mode change, or a workflow close alone.
  GRAPH-DOCUMENT-0024 permits a target session, its lineage and its bounded
  queue to remain detached after a document closes, so "workflow close" is
  not a safe clearing boundary: pending entries and their identities survive
  a detached session so a late result can still correlate against them. Only
  the document object's destroy clears the registry entry. Destruction proves
  only that the client is abandoning correlation for that lineage, not that
  the host rejected anything still parked — so any entry still parked at
  that point settles as an explicit `abandoned` outcome: no revert, no
  rejected-operation notification, consistent with the dependency contract
  above, where only an explicit host rejection triggers revert-and-notify
  compensation. No later frame can arrive to settle these entries any other
  way, which is exactly why destruction, not an inferred rejection, is the
  correct terminal outcome for them. This lands
  in two steps: PR A keeps the ledger inside the follower and closes only the
  tab-deactivation gap; PR A1 hoists its ownership to workflow/document scope
  and to the destruction boundary, and this ADR's guarantee does not hold
  for panel close/reopen until A1 lands. `createOpSender`'s `detach()` drops
  in-flight batches without settling them, so PR A also makes the follower
  call `abortAll()` before `detach()`: queued and open batches settle
  `undeliverable` and an in-flight one settles `unconfirmed` (parked,
  resolved per the settlement rules below). The registry drops a lineage
  only on destruction, so it cannot grow across ordinary workflow closes and
  reopens of the same document.
- **The ledger is the only source of pending-delete intent.**
  `pendingHumanDeletes()` becomes a read over the ledger: a `delete_node` in
  any non-terminal state, including `applied` until its effect frame lands,
  is a pending delete. This is the wiring CRDT-WRITE-0035 defers, and it
  replaces the two-sources-that-can-disagree shape #18078 left behind.
- **`unconfirmed` joins `unacknowledged` in the parked set as
  `delivery_unknown`, and a `doc_subscribed` acknowledgement never settles a
  parked entry by itself.** Both `unconfirmed` and `unacknowledged` mean the
  host may have applied the batch. The wire carries no echoed subscribe or
  request identity — `doc_subscribed` has only the workflow id, status and
  `seq` — so a duplicate acknowledgement is indistinguishable from a fresh
  one: with `subscribe1, ack1, dup ack1` nothing marks the second ack as a
  repeat, and with `subscribe1, subscribe2, ack1, dup ack1, ack2` nothing
  says which subscribe the duplicate answers. Both are undecided from the
  wire alone, so no acknowledgement-based rule — a local counter, a
  generation id, or treating the ack itself as a settlement barrier — can
  safely resolve a parked entry, and this ADR defines none. A parked entry
  settles only from one of three sources: (i) per-kind effect presence
  checked against a same-lineage authoritative document, evaluated on the
  local document immediately after reactivation (including when the
  resubscribe finds the state vector already current and no further frame
  follows) and again on every subsequent same-lineage frame, until resolved;
  (ii) an explicit host rejection; (iii) the bounded ledger terminal path
  below, for an entry that outlives both of the above within its own
  lifetime.

  Absence never _reverts_ an entry — not on an ordinary frame, not on a
  continuity-unknown reactivation (see below), and not at the terminal
  path's expiry. Absence _settles_ an entry only when absence is that
  entry's own success condition: `delete_node` settles `applied` when the id
  is absent. `add_node`, `connect` and `set_widget` settle only on presence
  (`set_widget` on value equality); when one of those instead reads as
  absent (or unequal), the entry simply stays parked as `delivery_unknown` —
  it is never reverted on that basis. The only source that reverts an entry
  is an explicit host rejection, per the dependency contract above; the
  bounded ledger terminal path below settles a parked entry that outlives
  everything else, but to a non-destructive outcome, never a revert. Once the backend echoes subscribe
  identity on `doc_subscribed` (named as a dependency in Sequencing below),
  an acknowledgement identified as belonging to the current subscribe may be
  used as a catch-up barrier in its own right; that wire change has not
  landed, so this ADR does not rely on one.

- **Per-kind resolution**, evaluated against the document per source (i)
  above: `add_node`, the node id is present and the document node's type
  equals the ledger entry's minted type; `delete_node`, the id is absent;
  `connect`, the specific link id is present; `set_widget`, the target
  widget's current value equals the op's value — never an unconditional
  clear, since last-writer-wins does not make an arbitrary document value
  proof that this op landed; `clear` is not parked. A present-and-matching
  check (or absence, for `delete_node`) settles the entry as `applied`. An
  `add_node`, `connect` or `set_widget` entry that instead reads as absent
  (or unequal, for `set_widget`) is left parked as `delivery_unknown` — it is
  never reverted on that basis, on this frame or any later one; the only
  thing that reverts a minted node, link or widget change is an explicit
  host rejection (see the dependency contract above), and that holds for
  every kind alike. Present-but-different-type is an id collision, handled
  as (c) handles it. Nothing is re-enqueued.
- **The pending ledger's own bounded terminal path settles a parked entry to
  a non-destructive `unresolved` outcome once its lifetime elapses — it
  never reverts.** CRDT-FOLLOWER-0035's ack-timeout retry times an
  _unanswered_ `doc_subscribe`; a successful `doc_subscribed` disarms that
  timer entirely, and even the terminal give-up state on that timer only
  reports and latches `connected: false` with no pending-ledger settlement
  hook — it was never a path that can expire a `delivery_unknown` entry, and
  citing it as one was wrong. The pending ledger instead owns its own bounded
  terminal path: each parked entry carries an absolute per-entry lifetime,
  `LEDGER_SETTLE_TIMEOUT_MS`, counted from the moment the entry is parked;
  its exact value is an implementation detail, not decided here. That
  lifetime is never extended by traffic: an idle-timeout shape, where an
  unrelated same-lineage frame resets the deadline, would let frequent
  unrelated activity keep a lost op ambiguous forever, so the deadline is
  scheduled once, at park time, against a fixed clock, and no later frame
  moves it.

  There is no other precondition on the deadline firing. An earlier draft of
  this rule also required a max-acknowledged-`seq` precondition and a
  quiescence (no-frame-arrived-within-the-bound) requirement before the
  deadline could fire; both are removed. The `seq` precondition treated an
  unidentified `doc_subscribed` acknowledgement's `seq` as proof the local
  document had caught up to a specific subscribe, but the wire carries no
  echoed subscribe or request identity (see above): a duplicate old
  acknowledgement can repeat a lower `seq` while the newer, real catch-up
  frame that would have resolved the entry safely is lost in transit,
  leaving the stale `seq` as false proof of causality and destructively
  reverting an operation the host had, in fact, applied. Quiescence has the
  same defect from the other direction: nothing on the wire establishes that
  a quiet document is _this_ lineage's settled state rather than a gap in
  delivery. Until the backend echoes subscribe identity or a lineage/
  generation token (both named as dependencies in Sequencing below), no
  signal available today can prove a parked entry is truly gone, so the only
  safe outcome the deadline may produce is a non-destructive one.

  When the lifetime elapses, the entry settles to a terminal outcome,
  `unresolved`: the local optimistic projection is retained exactly as it
  stands — no revert, and no rejected-operation notification. Instead, a
  distinct unconfirmed-edit notification tells the user this edit could not
  be confirmed as synced. The entry's identity stays registered after
  settling `unresolved`: a late echo or an explicit host response arriving
  afterward can still move it to `applied`, or to `reverted` on an explicit
  host rejection, until a lineage break (`doc_reset`) or the document's own
  destruction clears the registry entry per the ledger-lifetime rule above.
  Presence observed on any frame before the lifetime elapses still settles
  the entry first, per the per-kind rule above; the lifetime only governs
  what happens when nothing has. Unknown delivery is therefore bounded in
  **time** — it always becomes a visible terminal outcome within
  `LEDGER_SETTLE_TIMEOUT_MS` of being parked — but it is not resolved in
  **truth**: the backend lineage/generation token and the echoed subscribe
  identity, both named as dependencies in Sequencing below, are what would
  let this terminal outcome become a truthful revert instead of a standing
  `unresolved` state.

- **On a reactivation, a changed `seq` keeps parked entries parked; it is
  ordinary same-lineage progress, not proof of anything about them.** A
  resubscribe that follows a paused (tab-inactive) subscription checks
  continuity: the resume's `seq` equal to what this client last projected
  means the document did not change while away, so the per-kind resolution
  above runs unchanged. A different `seq` is ordinary same-lineage progress —
  another actor's edit, or one of this session's own parked entries taking
  effect while the tab was inactive. The per-kind document check above still
  runs in that case (presence, and matching type for `add_node`, still
  resolves the entry as `applied`, regardless of continuity); since absence
  never reverts on any frame (see above), a mismatched `seq` raises no
  separate destructive question of its own — an entry the check cannot yet
  resolve as `applied` simply stays parked as `delivery_unknown`, resolved by
  whichever of the three settlement sources above comes first: the next
  same-lineage `doc_update`, an explicit host rejection, or the ledger's own
  non-destructive `unresolved` outcome once its bounded lifetime elapses.
  Outside a reactivation, a `seq` mismatch is handled the same way: the
  natural catch-up frame resolves things through the per-kind presence rules
  above, with no revert-on-absence to gate. This is accepted as incomplete
  only in timing, not in safety: without the backend lineage/generation
  token named above, some entries may sit parked longer than a resolved
  reactivation would need — tracked as a followup, not resolved here.
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
while it is parked, and it settles `applied` once the per-kind document
check finds the node absent. If the host still holds the node — the delete
never took effect — the entry stays parked as `delivery_unknown`: it clears
only on an explicit host rejection, which reverts the local delete and fires
the standard rejected-operation toast, or, failing that, on the ledger's own
bounded terminal path, which settles it `unresolved` with the
unconfirmed-edit notification instead and keeps the local optimistic delete
in place.

### Durable guarantee vs. interim mechanism

Four behavior requirements are durable and should outlive any one mechanism
below: an unresolved human intent is never silently discarded by a reconcile;
a host rejection is reported; an outcome whose delivery is unknown becomes a
visible terminal outcome within a bounded time — `applied` or `reverted` when
per-kind document presence or an explicit host rejection resolves it,
otherwise a non-destructive `unresolved` outcome once the ledger's own
bounded terminal path elapses — never settled by an acknowledgement alone,
and never ambiguous indefinitely _in time_, though truthful resolution (a
real revert instead of a standing `unresolved`) still depends on
backend-supplied identity that has not landed; and any collision the
available provenance can identify is reported, with the document winning.
Provenance today is op-identity-based
(the ledger's `add_node` entry for a node id, in a state the host can have
echoed): a same-type, same-id replacement under an add that never reached the
ledger converges silently, without a report — the negative consequence
recorded below.

| Requirement                                                                                                                                                                                                                                                                                                                                                  | A                     | A1                    | B                                                  | C                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------- | -------------------------------------------------- | ----------------------------------- |
| Unresolved intent survives a reconcile (queued/in-flight never discarded)                                                                                                                                                                                                                                                                                    | tab-deactivation only | + panel close/reopen  | + lineage-aware `removeMissing`/orphan sweep       | —                                   |
| A host rejection is reported                                                                                                                                                                                                                                                                                                                                 | yes                   | yes                   | yes                                                | —                                   |
| Delivery-unknown becomes a visible terminal outcome within a bounded time: `applied` via per-kind document presence, `reverted` only via an explicit host rejection, or the ledger's own non-destructive `unresolved` outcome once its bounded lifetime elapses (never via an acknowledgement alone; absence never reverts, on any frame or at reactivation) | yes                   | yes                   | yes                                                | —                                   |
| An identifiable collision is reported, not resolved silently                                                                                                                                                                                                                                                                                                 | incremental path only | incremental path only | + full-reconcile path, once the known-id set lands | —                                   |
| Blueprint definitions reach the document                                                                                                                                                                                                                                                                                                                     | —                     | —                     | —                                                  | pending (PR C; no external blocker) |

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
the host can have seen: `inflight`, `applied`, `delivery_unknown` or
`unresolved` — a late echo against an `unresolved` entry is exactly the case
the terminal path's own registry retention (see (a) above) exists to still
resolve correctly, as `applied` rather than a fresh collision. A
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

No package dependency blocks this: the consumed
`@comfyorg/comfy-multi-player` package already exports `DefineSubgraphOp` and
its applier already handles `define_subgraph`. The remaining gap is entirely
frontend-side —
`layoutMintPort.ts` has no mint path for it. When the human insert path
(`_deserializeItems`, subgraph blueprint drop or paste) creates a definition
the bound document lacks, the layout mint port must emit `define_subgraph`
for that definition (nested definitions first) ahead of the host's
`add_node`, in mint order, so the applier registers the type before the node
that uses it. This is PR C's entire scope now; nothing in PR A, A1 or B
depends on it, and no package-integration PR blocks it. Until PR C lands, the
host lands as an opaque positional node (#18078) and the port reports once
per definition id (`agent_crdt_blueprint_definition_not_in_doc`).

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
  bypasses the op log; rejected in favour of the `define_subgraph` op the
  package already carries.

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
- **PR C**, independent of A, A1 and B: implements the (d) mint path in
  `layoutMintPort.ts`. No package-integration PR blocks it — the consumed
  comfy-multi-player package already carries `DefineSubgraphOp` and its
  applier.

The file/test-level rollout checklist for this stack (exact files touched,
test names, fixture wiring) is tracked outside this ADR. Server dependencies
named, not owned here: per-op outcomes on `doc_ops_result` or op ids on
`doc_update` (for effect-correlated clearing); a per-lineage generation or
reset counter on the subscribe acknowledgement (for the reactivation-
continuity gap in (a) above); and echoed request/generation identity on
`doc_subscribe`/`doc_subscribed` (so an acknowledgement identified as
belonging to a specific subscribe may be used as a catch-up barrier in its
own right — this frontend-only PR does not rely on one today). See "Rollout
status" below for dependency order; current PR/branch/status facts are
tracked outside this ADR.

## Rollout status

Architectural dependency order lives in Sequencing above. This section
deliberately does not carry PR numbers, branch names, head SHAs, package
versions, or other in-flight status — those live in the implementation
stack's own tracking issue, since they drift independently of the decisions
recorded here.

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
- Parking `delivery_unknown` entries delays the rejected-operation toast for
  a batch the host actually rejected while the tab was away, until the
  explicit rejection itself arrives or, failing that, until the ledger's own
  bounded terminal path elapses and shows the milder unconfirmed-edit
  notification instead — a deliberate trade of a slower, sometimes
  wrong-shaped notification against ever reverting an effect the document
  actually holds. An entry that settles `unresolved` and is only later
  confirmed rejected surfaces the standard rejected-operation notification at
  that point, so the same edit can present two different notifications in
  sequence; an entry that settles `unresolved` and is never confirmed either
  way stays a standing, user-visible unconfirmed edit until a lineage break
  or destruction clears it.
- Seq-based clearing, like effect clearing, trusts an `applied` list that
  counts `lww-dropped` and `no-op`; until the host frame carries per-op
  outcomes some divergence stays unreported.
- The human-path `define_subgraph` mint keeps its interim behaviour until PR
  C lands; the gap is frontend-only now (`layoutMintPort.ts` has no mint path
  for it), not blocked on any package-integration chain.
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
