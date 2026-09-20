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
   `onBatchSettled` to `recordDevEvent('human_ops_settled', ...)` and nothing
   else. `pendingOpLedger.ts` has a complete `failed` / `unprocessed` state
   machine and no production caller. A rejected `add_node` leaves a node that
   is live locally and permanently absent from the document.
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
entries. Its revert-and-toast for a host-rejected `add_node` stands, as does
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
- **`unconfirmed` joins `unacknowledged` in the parked set.** Both mean the
  host may have applied the batch. Parked entries enter `delivery_unknown`
  and resolve at the next same-lineage catch-up by a per-kind effect check:
  `add_node`, the node id is present in the document's nodes map;
  `delete_node`, it is absent; `connect`, the link id is present in the links
  map; `set_widget` clears on seq coverage only, since last-writer-wins makes
  a value comparison meaningless; `clear` is not parked and settles as #16309
  settles it. Present clears the entry; absent reverts it with #16309's
  existing toast (an `add_node` removes the node, other kinds toast only).
  Nothing is re-enqueued. `undeliverable` reverts as #16309 does today.
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
the delete reverts and the toast fires. The divergence is surfaced, not
silent.

### Durable guarantee vs. interim mechanism

This ADR is deciding two different things, and they age differently. The
guarantees are durable, independent of how the layer is implemented: an
unresolved human intent (a queued or in-flight op) is never silently
discarded by a reconcile, and any collision between local and document state
is reported rather than resolved silently, with the document winning. Those
are the requirements this ADR exists to satisfy, and they should outlive any
one mechanism below.

The mechanism in (b) and (c) — ledger-aware and lineage-aware
`removeMissing`, the materializer's orphan sweep, and the ledger-gated
`reconcileNode`/`reconcileNextFrame` echo check — is interim. It is the
correct next step given the store-first projection the follower runs today,
but it is a compensator for that projection, not the design this ADR is
betting the guarantee on long-term. There is a proposed semantic-apply
direction under discussion (store-first projection replaced by semantic
`LGraph`/`LGraphNode` apply with call-carried provenance) that, if adopted,
would remove the root cause these compensators work around instead of
compensating for it. Adopting that direction is out of scope here, is not a
prerequisite for landing (a)-(d), and is not decided by this ADR.

If that direction is adopted, the following are deleted, not amended:
`removeMissing`'s ledger- and lineage-awareness, `reconcileNode`,
`reconcileNextFrame`, the materializer's repair pass, and the ledger checks
in the adapter that gate those branches (all of (b) and the reconcile half
of (c)). What survives unchanged: the ledger's own intent record (the
queued/in-flight/terminal state per human op) and its rejection reporting
(the revert-and-toast and `reportError` calls in (a)) — those satisfy the
durable guarantee under either mechanism and are not compensators for the
store-first projection.

### (b) `removeMissing` and the orphan sweep are ledger-aware and lineage-aware

Both scopes apply; neither alone covers the two repros.

- **Ledger-aware.** A node with an `add_node` in any non-terminal ledger
  state is retained by `removeMissing` and by the materializer's orphan
  sweep. A node with a non-terminal `delete_node` is not re-created by a
  reconcile upsert. This keeps #18063's deleted node deleted and #18078's
  never-landed node alive until the ledger resolves.
- **Lineage-aware.** A session records the document's node and link ids at
  `bind()` (the bridge keeps the `FollowerDoc` across a same-workflow
  resubscribe, so this is the document as of leaving) and every id a later
  frame adds. `removeMissing` removes only ids in that set that the document
  no longer holds. An id the document never held is retained and reported
  once per session (`reportError`, `agent_crdt_local_only_node_retained`, dev
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

The adapter's incremental path treats an `add` action whose node id is already
registered in the store as `reconcileNode`, not `addNode`, only when the
ledger holds an `add_node` for that node id in any state; the batch commits
and `reconcileNextFrame` stays false. The ledger survives deactivation per
(a), so the echo case is always covered. Otherwise the `add` is an id
collision between a retained local-only node and a document node minted under
the same graph-local integer (the document never saw the local node, so it
hands the id out again). The adapter reports it (`reportError`,
`agent_crdt_node_id_collision`, with node id, local type and document type)
and the document wins: the existing `replaceNode` path applies. This is the
one case in which a node (b) retained leaves the canvas, and it is reported,
never silent. The frame's `actor` stays advisory and is not a filter: the
catch-up frame folds many actors.

### (d) Blueprint definitions: mint `define_subgraph` on the human insert path

The frontend cannot fix gap 4 alone. When the human insert path
(`_deserializeItems`, subgraph blueprint drop or paste) creates a definition
the bound document lacks, the layout mint port emits `define_subgraph` for
that definition (nested definitions first) ahead of the host's `add_node`, in
mint order, so the applier registers the type before the node that uses it.
The op itself is #17454's, but that chain is stale: #16644 (the workspace
move meant to give the frontend its own writable copy of
`packages/comfy-multi-player`) closed unmerged on 2026-09-17, `main` still
consumes the npm-published `@comfyorg/comfy-multi-player@0.2.1`, and #17454
is still a draft based on #16644's now-abandoned branch head. No live
successor package-integration path is verified as of this writing.
**PR C is therefore blocked pending a new package-integration plan**, not
merely pending review of the existing chain: #17454 must be restacked onto
`main` (or replaced) once that plan exists, and #17458 (which projects the
definitions #17454's applier writes) is blocked on it in turn. Nothing in PR
A, the ledger-ownership follow-up, or PR B depends on this chain. Once a
plan exists, the remaining preconditions are unchanged: the op lands in the
package, the frontend consumes it, and the doc host admits it from human
actors. The server-side doc host pins the npm package separately, so a
package release carrying the op is still required even once the frontend
consumes a workspace or updated npm copy. Until then the host lands as an
opaque positional node (#18078) and the port reports once per definition id
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
  unmount). Acceptance: a rejected human add is reverted and reported, and
  an echo of the page's own accepted add reconciles instead of forcing a
  full resync.
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
(for effect-correlated clearing), and `define_subgraph` admission from human
actors (for C).

## Consequences

### Positive

- A human edit the host refuses is visible (toast, `reportError`) and, for an
  add, undone; it can no longer sit on the canvas as a permanent orphan.
- A rebind or same-lineage catch-up removes only state the document once
  held; local-only state is retained and reported. The one exception, an id
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
- Parking `delivery_unknown` entries until the next catch-up delays the toast
  for a batch the host actually rejected while the tab was away.
- Seq-based clearing, like effect clearing, trusts an `applied` list that
  counts `lww-dropped` and `no-op`; until the host frame carries per-op
  outcomes some divergence stays unreported.
- The human-path `define_subgraph` mint is blocked on the (d) chain, so gap 4
  keeps its interim behaviour for a while.

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
