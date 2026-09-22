# ADR-CRDT-RECONCILE-0035: Local-Only State Survives Authoritative Reconcile

Date: 2026-09-19

## Status

Proposed

## Context

Human canvas edits reach the shared semantic document optimistically: the
LiteGraph mutation lands locally first, the mint ports turn it into a wire op,
and `opSender.ts` carries it to the doc host. The follower then treats the
document as authoritative. Four gaps in that loop let a legitimate local edit be
deleted without anyone being told. All four were confirmed by reading current
`main` and by the repros in
[#18078](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18078) and
[#18063](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18063).

1. **A host-rejected human op is swallowed.** `useAgentCrdtFollower.ts` wires
   `onBatchSettled` to `recordDevEvent('human_ops_settled', ...)` and, since
   #18078, to a `confirmedDeletes` set: an acknowledged `delete_node` stays
   pending until the document frame removes its node, and
   `pendingHumanDeletes()` unions that set with `sender.pendingOps()` into the
   adapter's `LocalIntent.pendingDeletes`, which the reconcile upsert already
   filters out. That covers pending-delete intent only. The rejection half is
   still missing: `pendingOpLedger.ts` has a complete `failed` / `unprocessed`
   state machine and no production caller. A rejected `add_node` leaves a node
   that is live locally and permanently absent from the document.
2. **The first frame after a follower rebind deletes every local node the
   document lacks.** `EcsFollowerAdapter.createSession` sets
   `reconcileNextFrame: true`; the first `doc_update` after a tab return runs
   `batch.removeMissing(docNodeIds, docLinkIds)`, `graphMutations.ts` deletes
   the store record, and `agentNodeMaterializer.ts`'s orphan sweep removes the
   live node with `graph.remove(orphan, { preserveCanonicalState: true })`.
   The integration test "removes local-only state from the first
   authoritative snapshot" pins this as intended. It cannot distinguish a
   stale local canvas from an edit the document never received.
3. **The echo of the page's own accepted add arms a full reconcile.** The
   host fans the accepted batch back as a `doc_update`; the incremental path
   calls `batch.addNode` for the `add` action and `prepare()` rejects it with
   `node id N is already registered`. The failed batch sets
   `reconcileNextFrame = true`, so the frame after every accepted human add is
   a full reconcile during ordinary editing. The relay's `doc_update` carries
   `actor` and `seq` but no op ids, so the follower cannot recognise its own
   echo by op identity today.
4. **A human-inserted subgraph blueprint carries no definition into the
   document.** The pinned `@comfyorg/comfy-multi-player@0.2.1` vocabulary is
   `add_node`, `connect`, `set_widget`, `delete_node`, `clear`; the standalone
   package has no `define_subgraph`. That op exists only in draft
   [#17454](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17454), written
   against the in-monorepo `packages/comfy-multi-player/` copy whose base is
   the workspace-move PR
   [#16644](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644). The
   human insert path (`LGraphCanvas._deserializeItems` to the layout mint
   port) mints only an `add_node` typed by a definition id the document has
   never seen. The host survives (#18078), but the agent cannot see inside it.

#18078 removes the trigger for the reported node classes by keeping positional
`widgets_values` for `isVirtualNode` classes in `serializeForMint`. It does not
touch gaps 1 to 4. This ADR decides how the layer behaves so that local-only
state is never again deleted silently, and how the work is cut so it does not
collide with the open PRs already editing the same files.

### Prior design already in flight

- [#16309](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16309)
  (optimistic-overlay pending ledger and shadow) carries a proposed
  `ADR-CRDT-PENDING-0030` (the 0030 suffix is shared with two unrelated ADRs,
  `TELEMETRY-STARTUP-0030` and `WEBSITE-REQUESTS-0030`; identifiers are unique
  by their full name) and implements most of gap 1: a `pendingOpTracker`
  wired into `opSender`'s `onBatchMinted` / `onBatchTransmitted` /
  `onBatchSettled`, a revert applier that removes a rejected `add_node`'s node
  under `layoutStore.withActor` plus `runMintPortsSuppressed`, and one warning
  toast per settle. It already parks an `unacknowledged` batch (emits
  `delivery_unknown`, leaves the entries in flight) and reverts on every other
  non-acknowledged outcome.
- [#18071](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18071) fixes the
  paste position-ordering bug and splits `opSender`'s unbound settle into
  `'unconfirmed'` (transport carried it, no result) and `'undeliverable'`
  (never carried).
- #17454 adds `define_subgraph` to the in-monorepo package and
  [#17458](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17458) projects
  definitions cleanly. Together they are the package side of gap 4.

## Decision

The document stays authoritative for what it has seen. It is not authoritative
for what it has never been told about. Concretely:

### (a) Rejected and unresolved human ops: #16309's ledger, longer-lived

The pending-op tracker from #16309 is the ledger of record and this ADR does
not re-decide it: every minted human op is registered before it flies, marked
in flight per transmit, reconciled per outcome on settle, and leaves only on
its authoritative effect, on an explicit revert, or on a lineage reset. Its
states are the ledger's own (`queued`, `inflight`, `applied`, `skipped`,
`failed`, `unprocessed`); this ADR adds one, `delivery_unknown`, for parked
entries. Terminal states are `skipped`, and `failed` and `unprocessed` once
their revert has run, and `applied` once seq coverage or the effect frame
clears the entry. Everything else (`queued`, `inflight`, `applied` awaiting
clearance, `delivery_unknown`) is non-terminal, and is what (b) and (c) mean
by a pending entry. Its revert-and-toast for a host-rejected `add_node` stands, as does
its first-pass scope (non-add reverts are toast-only). The deltas, decided
here and landed in PR A:

- **The ledger is owned per bound workflow/document, not per follower
  mount.** #16309 calls `pendingOps.reset()` in the follower watch's
  `!active` branch, before `retarget(null)` settles the in-flight batch, so
  on a tab switch the ledger is empty at the first frame after the return
  and (b) would have nothing to consult. Resetting only on deactivation is
  not enough on its own: reading current `main` confirms
  `useAgentCrdtFollower` constructs the tracker's seam (`createOpSender`)
  inside an effect scope owned by `AgentPanelRoot`, and an ordinary panel
  close or mode change stops that scope and tears the tracker down with it —
  that is not a lineage break. After a remount on the same workflow, a
  pending `delete_node` has no ledger entry, so catch-up can silently
  restore the node the user deleted; lineage-aware `removeMissing` in (b)
  only protects absent local adds, not pending deletion intent. The ledger
  instead lives in a store or registry keyed by the bound workflow/document's
  lineage id: created on first bind to that lineage, independent of any one
  follower mount, and cleared only on an actual lineage break (the document
  is reset or replaced, the workflow is closed, or the document is
  explicitly destroyed) — never on panel close or a mode change alone.
  Acceptance case: close the agent panel with a pending human delete still
  in the ledger, reopen it on the same workflow, and confirm catch-up does
  not restore the deleted node. This lands in two steps, not one: the first
  tracker PR (stacked on #16309) keeps the ledger inside the follower and
  closes only the tab-deactivation gap; hoisting its ownership to
  workflow/document scope is the following PR in the stack, and this ADR's
  guarantee does not hold for panel close/reopen until that PR lands.

  Hoisting the ledger alone is not enough. `createOpSender`'s `detach()`, run
  from the follower's scope-dispose list, drops queued, open and in-flight
  batches without settling them, so their entries would outlive the mount in
  a non-terminal state with no outcome to resolve them. PR A therefore makes
  the follower call `abortAll()` before `detach()`: queued and open batches
  settle `undeliverable` (revert and toast) and an in-flight one settles
  `unconfirmed` (parked, resolved at the next barrier). A1 moves the sender
  into the same lineage-scoped registry as the ledger, so an unmount no
  longer interrupts delivery at all. The registry records the lineage id
  each ledger was created for; `bind()` compares it with the document's, and
  a mismatch (a `doc_reset` or `follower_replaced` that happened while no
  follower was mounted) clears that ledger and its known-id set before the
  first frame. Entries are evicted with their workflow: the registry drops a
  lineage when its workflow closes, so it cannot grow without bound; every
  lineage ends in a close or a break.

- **The ledger is the only source of pending-delete intent.**
  `pendingHumanDeletes()` becomes a read over the ledger: a `delete_node` in
  any non-terminal state, including `applied` until its effect frame lands,
  is a pending delete. #18078's `confirmedDeletes` set is deleted in PR A,
  not kept alongside; two sources of pending-delete intent that can disagree
  (the ledger clears on seq coverage, `confirmedDeletes` holds until the
  node leaves the document) is the bug this section removes, and the ledger
  keeps the stronger of the two rules by holding an `applied` delete until
  either the effect frame or seq coverage clears it.
- **`unconfirmed` joins `unacknowledged` in the parked set, and parking has a
  deadline.** Both mean the host may have applied the batch. Parked entries
  enter `delivery_unknown` and resolve at the **catch-up barrier**: the
  first authoritative frame the follower applies after (re)binding the same
  lineage, or, when the resubscribe finds the preserved state vector already
  current and no frame follows, the `doc_subscribed {ok:true}` ack itself,
  since the local document then equals the host's. The barrier always
  arrives once the tab is bound again. While the tab is away nothing is
  projected, so a parked entry retaining its node is inert, and a lineage
  break clears it with the rest of the ledger. Resolution is per kind,
  evaluated against the document as of the barrier: `add_node`, the node id
  is present and the document node's type equals the ledger entry's minted
  type; `delete_node`, the id is absent; `connect`, the link id is present;
  `set_widget` clears unconditionally at the barrier, since it has no ack
  seq to cover and last-writer-wins makes whatever value the document holds
  a valid outcome; `clear` is not parked and settles as #16309 settles it.
  Present-and-same-type clears the entry. Absent reverts it with #16309's
  existing toast (an `add_node` removes the node, other kinds toast only);
  the revert removes a node only when the document does not hold its id, so
  it can never delete an authoritative node. Present-but-different-type is
  an id collision and is handled as (c) handles it. Present-and-same-type
  under an id another actor minted while ours never landed is
  indistinguishable from our own landed add without op ids on `doc_update`;
  this ADR accepts that residual, since local and document nodes then agree
  on id and type and the projection converges, and names the per-op frame
  upgrade below as what closes it. Nothing is re-enqueued. `undeliverable`
  and `unprocessed` revert as #16309 does today; its tracker already
  reverts `unprocessed` with the same toast as `failed`.
- **The ack-as-barrier path is gated by an outstanding subscribe
  generation, and, after a reactivation, by continuity with what was last
  projected.** The transport can re-deliver a successful `doc_subscribed`
  ack for one logical (re)subscribe (a delayed retry response, or a genuine
  duplicate) — sequence equality with the current watermark cannot tell a
  fresh ack from a stale repeat of one already acted on, so the client
  tracks a local, per-session counter that advances once per subscribe
  frame it actually sends and tags it onto every ack for that outstanding
  subscribe; only the FIRST ack naming a given counter value is consumed as
  a barrier. This is a same-session counter, not a protocol generation
  token the host echoes back, so it cannot by itself prove an ack belongs
  to this client's own history rather than to a document the host silently
  reminted under the same workflow id while the tab was away — that
  requires a backend wire change (e.g. a per-lineage generation id or reset
  counter carried on `doc_subscribed`/`doc_reset`), which this frontend-only
  PR does not have and is not deciding. Pending that dependency, a
  resubscribe that follows a paused (tab-inactive) subscription checks
  CONTINUITY instead: the resume's ack `seq` equal to what this client last
  projected means the document did not change while away (`seq` only
  advances), so the ack-as-barrier path above runs unchanged. A different
  `seq` there is treated as "continuity unknown, not disproven": rather than
  trusting a catch-up frame is coming and letting the ledger ride it out,
  the client conservatively invalidates — every currently parked entry is
  reverted now (as if its effect were absent) and every batch the sender
  still holds settles (queued/open ones `undeliverable`, a
  transmitted-but-unacknowledged one parked, left for the strict per-kind
  rules at whatever frame arrives next) — and, for the SAME reason, a full
  reconcile that runs before that ack is consumed retains none of the
  ledger's pending adds/connects, since a live or catch-up frame can reach
  it before the ack does. Outside a reactivation (an ordinary resubscribe
  while the tab stayed active — a sequence gap or a reconnect), a `seq`
  mismatch is left alone: the client's state vector was never stale there,
  so the natural catch-up frame is trusted to arrive and resolve things
  through the ack-as-barrier path's own per-kind rules instead. This
  mitigation is accepted as incomplete: it protects the ledger from a
  reactivation it cannot vouch for, but it cannot detect or repair whatever
  the underlying Yjs document itself does when a stale state vector is sent
  against a silently reminted lineage — that is the backend dependency
  above, tracked as a followup, not resolved by this PR.
- **Per-frame order is fixed: resolve, apply, clear.** For each
  authoritative frame the follower (1) resolves parked entries against the
  document state the frame produces and marks them terminal, (2) applies the
  frame's projection with the ledger as it stands after step 1, so (b)'s
  pending-delete filter no longer hides a node whose delete just reverted
  and (c)'s echo gate still sees the `add_node` entry the frame echoes, then
  (3) clears the entries whose ack seq the frame's `seq` covers. Clearing
  before applying would strip the echo gate's entry in the very frame that
  echoes it and misreport every accepted human add as a collision.
- **Every host rejection is reported.** A `failed` outcome additionally calls
  `reportError` with a stable `errorType` (`agent_crdt_human_op_rejected`) and
  the host's failure `code`, op kind and node id in `context`, never the
  payload (ADR-TELEMETRY-DIAGNOSTICS-0019). The toast is the user-facing half.
- **Clearing without op ids is seq-based.** #16309's `onDocEffect` is fed from
  `DocUpdate.opIds`, which the relay never populates, so it never fires in
  production. Every `doc_update` and `doc_ops_result` does carry the
  workflow's monotonic `seq` (omitted when 0), so an applied entry clears when
  the follower projects a seq at or after its ack seq, the mechanism #16309
  already uses for skipped duplicates. The hole in both mechanisms: the host's
  `applied` list includes `lww-dropped` and delete-wins `no-op` outcomes, so
  an op that never took effect clears as applied and its optimistic state
  stays divergent, unreported. Closing that needs the per-op-outcome host
  frame upgrade already named in `opSender.ts`'s header comment.

For #18063's shape (a `delete_node` still queued when the tab switches) this
means: the delete is parked, (b) keeps the node out of the reconcile upsert
while it is parked, and if the host still holds the node after the catch-up
barrier the delete reverts and the toast fires. The divergence is surfaced, not
silent.

### Durable guarantee vs. interim mechanism

This ADR is deciding two different things, and they age differently.
Independent of how the layer is implemented, four behavior requirements are
durable and should outlive any one mechanism below:

- an unresolved human intent (a queued or in-flight op) is never silently
  discarded by a reconcile;
- a human op the host rejects is reported to the user;
- an outcome whose delivery is unknown is resolved at the next same-lineage
  catch-up barrier rather than left ambiguous indefinitely;
- any collision between local and document state that the available
  provenance can identify is reported rather than resolved silently, with
  the document winning. Provenance today is op-identity-based (the ledger's
  `add_node` entry for a node id, in a state the host can have echoed): a
  same-type, same-id replacement under an add that never reached the ledger
  (never minted, or minted under a different actor's id) is indistinguishable
  from the page's own echo and converges silently, without a report — the
  negative consequence recorded below. Closing that residual is a
  prerequisite (per-op identity broader than the ledger's own opId), not
  something the guarantee can assume today.

Which slice establishes which requirement, so a reader does not have to
infer it from the Sequencing acceptance cases:

| Requirement                                                                                                                                                         | A                     | A1                    | B                                                  | C                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------- | -------------------------------------------------- | -------------------------- |
| Unresolved intent survives a reconcile (queued/in-flight never discarded)                                                                                           | tab-deactivation only | + panel close/reopen  | + lineage-aware `removeMissing`/orphan sweep       | —                          |
| A host rejection is reported                                                                                                                                        | yes                   | yes                   | yes                                                | —                          |
| Delivery-unknown resolves at the next catch-up barrier (or, after a reactivation, only once continuity is established — see the generation/continuity bullet above) | yes                   | yes                   | yes                                                | —                          |
| An identifiable collision is reported, not resolved silently                                                                                                        | incremental path only | incremental path only | + full-reconcile path, once the known-id set lands | —                          |
| Blueprint definitions reach the document                                                                                                                            | —                     | —                     | —                                                  | blocked (see Dependencies) |

A blank cell means that slice does not change the requirement's status from
the slice before it; "—" means the slice does not touch that requirement at
all.

Under the store-first projection the follower runs today, section (a)'s
workflow/document-scoped ledger and (b)/(c)'s ledger-aware compensators
supply all four together: the ledger records each op's outcome, (b) and (c)
consult it to decide what to retain or reconcile, and the revert-and-toast
plus `reportError` calls surface rejections and collisions.

That whole mechanism is interim, not only the compensators in (b) and (c).
There is a proposed semantic-apply direction under discussion (store-first
projection replaced by semantic `LGraph`/`LGraphNode` apply with
call-carried provenance) that, if adopted, does not just remove the
compensators' root cause: it deletes the parallel pending ledger itself and
re-evaluates #16309, because a command-minted operation already carries its
own identity (`opId`/actor provenance at the command site), so satisfying
the same four requirements would use command-carried provenance plus
ingress echo filtering instead of a separate ledger lookup. Adopting that
direction is out of scope here, is not a prerequisite for landing (a)-(d),
and is not decided by this ADR.

If that direction is adopted, the following are deleted or replaced, not
amended: `removeMissing`'s ledger- and lineage-awareness, `reconcileNode`,
`reconcileNextFrame`, the materializer's repair pass, the ledger-gated echo
check in (c), and `pendingOpLedger.ts` itself, whose intent-tracking and
rejection-reporting role would move to command-carried provenance and
ingress echo filtering. The four requirements above are what must keep
holding across that change; neither the ledger nor the compensators are
guaranteed to survive it unchanged.

### (b) `removeMissing` and the orphan sweep are ledger-aware and lineage-aware

Both scopes apply; neither alone covers the two repros.

- **Ledger-aware.** A node with an `add_node` in any non-terminal ledger
  state is retained by `removeMissing` and by the materializer's orphan
  sweep. A node with a non-terminal `delete_node` is not re-created by a
  reconcile upsert. This keeps #18063's deleted node deleted and #18078's
  never-landed node alive until the ledger resolves. A widget with a
  non-terminal `set_widget` keeps its local value through a full reconcile;
  the upsert projects every other field and every other widget, the entry
  resolves by seq coverage or at the barrier, and last-writer-wins then
  decides.
- **Lineage-aware.** The session keeps a lineage-scoped **known-id set** in
  the same registry as the ledger (per follower until A1 lands): the node
  and link ids the document holds now, plus ids it held whose removal
  `removeMissing` has not yet applied locally. Ids enter the set at `bind()`
  and as frames add them; an id leaves the set only when a local sweep has
  removed it, never merely because the document dropped it. `removeMissing`
  removes exactly the ids in the set that the document no longer holds, so
  the rule is never vacuous, and an id the document once held and later
  reissued to a never-minted local node is retained, because the earlier
  sweep took it out of the set. This set is per-follower until A1 lands
  (same as the ledger); ONLY once A1 hoists it to the workflow/document
  registry does it outlive a panel unmount, so a node deleted remotely
  while the panel was closed is still in the set at the next `bind()` and is
  swept as stale rather than retained as local-only. Before A1, a follower
  mount starts this set empty, so that case is not yet covered. An id the
  document never held is retained and reported once
  per session (`reportError`, `agent_crdt_local_only_node_retained`, dev
  event `local_only_retained`).

The genuine "stale local canvas" case is a lineage break. `doc_reset` and
`follower_replaced` already run `clearForReset` plus the sweep; that path is
unchanged and is the only path that may delete state the document never held.
The integration test "removes local-only state from the first authoritative
snapshot" is inverted: the first snapshot retains and reports the local-only
node; a following `clearForReset` removes it. "clears only the target owner
for an empty authoritative snapshot" follows the same rule: an empty document
at bind time knows nothing and removes nothing.

### (c) An echo of an own add is a reconcile; any other collision is reported

The adapter treats an `add` action whose node id is already registered in the
store as the echo of an own add (`reconcileNode`, not `addNode`; the batch
commits and `reconcileNextFrame` stays false) only when the ledger holds an
`add_node` for that node id in a state the host can have seen: `inflight`,
`applied` or `delivery_unknown`. A `queued` or `unprocessed` entry has never
reached the host and cannot have produced an echo, so an incoming add under
its id is a collision, and `agent_crdt_node_id_collision` fires. The same gate is NOT yet run in the full-reconcile path, and this is
narrower than originally decided: `applyFullReconcile` reads its node list
live off the document's own map on every reconcile, so "already registered
locally" is true for every ordinarily-synced node, not only a colliding
local-only one, and telling those apart needs (b)'s known-id set. Since that
set is not landed (it is PR B, after A1), the rebind path reconciles every
doc node without running this classification; (b)'s ledger-aware retention
(pending adds/connects survive `removeMissing`) still holds there, but a
same-id collision on the rebind frame converges silently, as the residual in
Consequences/Negative already records for the ledger-gated case. Running
this classification on the rebind path is deferred to PR B alongside the
known-id set it depends on. The ledger survives
deactivation per (a), so the echo case is always covered. A collision is a
retained local-only node and a document node minted under the same
graph-local integer (the document never saw the local node, so it hands the
id out again). The adapter reports it (`reportError`,
`agent_crdt_node_id_collision`, with node id, local type and document type)
and shows the user the same toast a revert gets, since this is the one path
in this ADR that removes a node the user created. The document wins by an
explicit replace, `deleteNode` then `addNode` from the document payload
under `layoutStore.withActor` with mint ports suppressed, whatever the
types: `prepare()`'s `reconcileNode` picks `replaceNode` only when the types
differ and merges same-type nodes, which would leave the retained local
node's links and widget identity in place. The frame's `actor` stays
advisory and is not a filter: the catch-up frame folds many actors.

### (d) Blueprint definitions: mint `define_subgraph` on the human insert path

The frontend cannot fix gap 4 alone. When the human insert path
(`_deserializeItems`, subgraph blueprint drop or paste) creates a definition
the bound document lacks, the layout mint port emits `define_subgraph` for
that definition (nested definitions first) ahead of the host's `add_node`, in
mint order, so the applier registers the type before the node that uses it.
The op itself was #17454's, but that chain is now closed, not merely stale:
#16644 (the workspace move meant to give the frontend its own writable copy
of `packages/comfy-multi-player`) closed unmerged on 2026-09-17, and #17454
(the `define_subgraph` op itself, stacked on #16644) closed unmerged in
turn on 2026-09-22 — `main` still consumes the npm-published
`@comfyorg/comfy-multi-player@0.2.1`, which has no `define_subgraph`.
#17458 — the FRONTEND PROJECTION half, which strips the applier's private
conflict-resolution bookkeeping from a projected definition before LiteGraph
consumes it — merged on 2026-09-22 anyway: it reads the definition shape the
op WOULD write directly off the raw Yjs doc, so it needed no dependency on
#17454 actually existing at runtime, only on the shape agreeing. **PR C is
therefore still blocked, but on a narrower remaining gap than before**: the
frontend projection side is done; what remains is (a) a live successor to
the closed op PR that actually adds `define_subgraph` to the package this
frontend consumes, and (b) the doc host admitting it from human actors —
the host still pins its own copy of the package separately, so a package
release carrying the op is required regardless of which frontend copy this
repo consumes. Nothing in PR A, the ledger-ownership follow-up, or PR B
depends on this chain. Until it closes, the host lands as an opaque
positional node (#18078) and the port reports once per definition id
(`agent_crdt_blueprint_definition_not_in_doc`).

## Alternatives considered

- **Re-enqueue held ops when the same workflow rebinds.** Rejected. Nothing
  discriminates a tab-switch `undeliverable` from a retry-budget or no-doc one
  (`BatchOutcome` carries no cause); `OpSender` has no resume API and polls
  its workflow id at transmit time; a re-applied `add_node` is not idempotent
  against a changed document, since the applier's op-id gate short-circuits
  only an op it already applied, and a never-applied add either overwrites a
  node the agent added under the same id or is `lww-dropped` while counted as
  applied; and no per-kind precondition was defined. The parked-then-verified
  path in (a) surfaces the same divergence without those risks.
- **Revert the optimistic mutation for every non-acknowledged outcome.**
  Simplest ledger, wrong for delivery-unknown and for a delete the user meant.
- **Keep rejected nodes and mark them "not synced" without reverting.**
  Leaves canvas and agent view divergent indefinitely; retained only as the
  interim for (d), where the divergence is a missing definition.
- **Ledger-aware `removeMissing` only.** Misses an add whose batch was never
  minted (mint gate closed, `serializeNode` returning null) and a node
  restored from `activeState` after a lineage reset emptied the ledger.
- **Lineage-aware `removeMissing` only.** Re-creates #18063's deleted node
  until the delete lands; the ledger is what says "local intent is deletion".
- **Treat every "already registered" add as a reconcile.** Would let a
  document node silently replace a retained local-only node with the same id
  once (b) starts retaining; hence the ledger gate in (c).
- **Re-mint the local node's id on collision (ADR-ECS-IDENTITY-0016).**
  Deferred, not adopted: the pinned applier does not remap ids, and
  ADR-CRDT-MINT-0018's rule that the applier resolves collisions before
  registration is a requirement on a future applier. Revisit when the applier
  remaps.
- **Filter own echoes by `actor`.** A single frame folds agent and human
  effects; a per-frame skip drops agent effects.
- **Host-side definition registration on first sight of an unknown type.**
  Moves frontend definition data into the host through a side channel and
  bypasses the op log; rejected in favour of #17454's op.

## Sequencing

Five dependency-ordered slices, each landing its failing test first. No new
feature flag: the whole layer sits behind `agentPanelStore.enabled`,
consumed by `mintGate.ts` and the follower lifetime, and is not generally
available; (b) and (c) fail safe by retaining more and reconciling less.
(a)'s revert applier is destructive when its resolution is wrong and gets no
kill-switch for the same reason; add a settings switch if the layer reaches
general availability before the revert path has soaked.

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
  bound workflow/document, per the delta decided in (a). Acceptance: the
  panel close/reopen case in (a) — closing the panel with a pending human
  delete and reopening on the same workflow does not restore the deleted
  node. This ADR's guarantee does not fully hold until A1 lands.
- **PR B**, after A1 and after the retry-accounting decision on #16358: (b),
  ledger-aware and lineage-aware `removeMissing` and orphan sweep.
  Acceptance: a node the user added whose `add_node` never reached the doc
  survives a tab-return reconcile, and a node the user deleted stays deleted
  across a tab switch even when the delete was still in flight.
- **PR C**, blocked on a new define_subgraph package-integration plan (see
  (d)); nothing in A, A1 or B waits on it.

Coordination and the file/test-level rollout checklist for this stack (exact
files touched, test names, fixture wiring, which open PRs are in flight) are
tracked outside this ADR, since that detail changes independently of the
architecture decision and goes stale quickly. Server dependencies named, not
owned here: per-op outcomes on `doc_ops_result` or op ids on `doc_update`
(for effect-correlated clearing), a per-lineage generation or reset counter
on the subscribe acknowledgement (for the reactivation-continuity gap in
(a)'s parked-entry bullet above), and `define_subgraph` admission from human
actors (for C).

### Status

The one snapshot in this ADR that goes stale independently of the
architecture it decides: PR C's remaining blocker, as (d) records it, is
narrower than it was — the frontend projection half landed, and what is left
is a live successor to the closed op change plus doc-host admission. This
paragraph, not the decision prose in (d), is where that fact is expected to
need updating again.

## Consequences

### Positive

- A human edit the host refuses is visible (toast, `reportError`) and, for an
  add, undone; it can no longer sit on the canvas as a permanent orphan.
- A rebind or catch-up barrier removes only state the document once held;
  local-only state is retained and reported. The one exception, an id
  collision under (c), is reported too.
- Ordinary editing stops arming a full reconcile on every accepted add, which
  also shrinks the blast radius of the sibling reconcile-overwrite bugs.
- One ledger (#16309's) is the source of truth for pending human ops; the
  adapter and the materializer query it instead of inferring intent.

### Negative

- Retained local-only nodes are a visible divergence until the ledger
  resolves or the user acts; the report is the mitigation, not a fix.
- Edits made before the first `bind()` are never minted (the mint gate is
  closed until the tab is active and bound), so under (b) they are retained
  and reported forever instead of deleted on the first snapshot; never-minted
  deletes during a teardown window are re-added by the reconcile and seen by
  neither half of (b). Neither outcome is right; the follow-up is an
  initial-sync mint of local-only state at first bind, or an explicit prompt.
- The known-id set and the longer-lived ledger add state that must reset on
  every lineage break; a missed reset retains stale state.
- Parking `delivery_unknown` entries until the next catch-up barrier delays
  the toast for a batch the host actually rejected while the tab was away.
- Seq-based clearing, like effect clearing, trusts an `applied` list that
  counts `lww-dropped` and `no-op`; until the host frame carries per-op
  outcomes some divergence stays unreported.
- The human-path `define_subgraph` mint is blocked on the (d) chain, so gap 4
  keeps its interim behaviour for a while.
- The same-type, same-id collision under a never-landed add clears as an
  echo until `doc_update` carries op ids; the projection converges but the
  user's node has been replaced by the document's without a report.

## Notes

- ADR-CRDT-FOLLOWER-0025 (raw updates flow host to follower only; human edits
  reach the document as semantic ops; the optimistic overlay clears on
  effect, not on ack) is unchanged; this ADR fills in its "optimistic
  overlay" and "echo-attribution" items. ADR-ECS-0008: the ledger and the
  known-id set are plain data in adapter-owned modules; no methods are added
  to `LGraph`, `LGraphNode` or `LGraphCanvas`. ADR-GRAPH-DOCUMENT-0024: only
  an explicit lineage break may wipe follower-derived state; (b) restates that
  for local-only state. ADR-CRDT-LAYOUT-0003: layout deletions still go
  through the layout store's command boundary.
- `ADR-CRDT-PENDING-0030` is proposed inside #16309 and is not on `main`.
  When it lands the two cross-reference, and the tracker-lifetime and
  parked-set deltas in (a) are recorded there as an amendment.
