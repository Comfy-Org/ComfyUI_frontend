# ADR-CRDT-PENDING-0030: Pending-Op Reverts Undo Optimistic Canvas State

Date: 2026-09-19

## Status

Proposed

## Context

Human graph edits are optimistic by construction: the LiteGraph flow applies the
edit locally first, then `mintPortWiring.ts`'s ports mint a wire op and
`opSender.ts` carries it to the doc host. When the host rejects the op (or the
batch settles `undeliverable`/`unprocessed`/`unattributed`),
`pendingOpTracker.ts` correctly computes a `reverted` outcome — but the only
consumer is a dev-panel log line in `useAgentCrdtFollower.ts`. Nothing undoes
the optimistic edit and nothing tells the user. The observed failure: a
host-rejected human `add_node` leaves a permanent orphan node on the canvas
that the shared doc never contained, silently diverging local state from every
other follower.

Three structural facts constrain the fix:

1. **The `reverted` event cannot be acted on today.** `pendingOpTracker.ts`'s
   `revert()` takes the ledger entry — which holds the full minted `Op`,
   including its kind and `node_id` — drops it, and emits only
   `{ type: 'reverted', reason, opIds }`. No consumer can map an opId back to a
   canvas target without duplicating the ledger.
2. **The mint side and the settle side are deliberately decoupled.**
   `attachMintPortWiring` receives a bare `enqueue` closure and never sees the
   sender, the tracker, or settle outcomes. The regression test
   `rejectedHumanAddNodeRevert.test.ts` pins this composition: whatever
   consumes `reverted` must be a unit the composition root (and the test) wires
   next to the tracker, not a back-channel inside the mint ports.
3. **Undoing the edit must not re-mint.** `LGraph.remove` ends in
   `detachNodeLayout` (`graphLayoutAttachment.ts`), which applies an
   actor-less `deleteNode` layout operation; the layout store stamps its own
   session actor (the `user-` prefix) on actor-less operations and delivers
   the change on a microtask — after any suppression bracket has ended — so
   the layout mint port's gate passes and a spurious `delete_node` is minted
   for a node the host never accepted. `runMintPortsSuppressed` alone cannot
   close this (`agentNodeMaterializer.ts` documents the bracket-vs-microtask
   gap and relies on remote provenance on the operation itself).

The precedent for "local graph holds a node the authoritative state does not"
already exists: `agentNodeMaterializer.ts`'s reconcile detaches doc-orphaned
nodes via `graph.remove(...)` under `runMintPortsSuppressed`, with provenance
keeping the deferred layout delivery unminted.

FE-2504 identifies that store-first remote apply and its reconciliation passes
violate the live `LGraph`/`LGraphNode` invariant. This ADR does not endorse that
architecture. Pending transport correlation remains useful after FE-2504, but
the canvas-specific compensating revert below is a migration bridge while
local human edits still happen before host acceptance.

## Decision

**1. Widen the tracker's `reverted` event to carry the ops it dropped.**
`PendingOpTrackerEvent`'s `reverted` variant becomes
`{ type: 'reverted'; reason; opIds: string[]; ops: Op[] }` — `opIds` is kept
so existing consumers and assertions keyed on ids survive. The ledger entry
already holds the `Op` on every revert path (failed, unprocessed,
unattributed, undeliverable); emitting it keeps one source of truth and lets
consumers act without duplicating the ledger's op state. The event surface has
two consumers today (dev-panel log, and the new revert applier below), so the
contract change is cheap now.

**2. Add a revert applier as its own module,**
`src/workbench/extensions/agent/crdt/pendingOpRevert.ts`: its registry captures
the live node object for each minted `add_node`, then removes that exact object
when the op reverts. A newer node that reused the same id is left intact. The
registry releases identities on every terminal tracker event. Every removal is
individually try/caught with `reportError` — `LGraph.remove` runs
`node.onRemoved?.()`
uncaught, so one throwing extension callback must not strand the batch's
other reverts. The composition root — `useAgentCrdtFollower.ts`'s `onEvent` —
calls it before the existing `recordDevEvent`, and
`rejectedHumanAddNodeRevert.test.ts` wires the same applier into its own
tracker's `onEvent`, mirroring production composition exactly.

**3. First pass covers `add_node` reverts only.** It captures only object
identity, not general before-state. The other kinds each need before-state the
ledger does not hold (a reverted
`connect` must remove a specific link; a reverted `set_widget` must restore the
old value; a reverted `delete_node` must re-materialize the node). The widened
event already carries full ops, so later kinds extend the applier without
another contract change. Non-`add_node` reverts keep dev-panel visibility and
gain the user-facing toast below.

**4. Removal runs the normal `LGraph.remove` teardown — not
`preserveCanonicalState` — inside `layoutStore.withActor` plus
`runMintPortsSuppressed`.** Unlike the materializer's detach (where the store
records are authoritative and must survive), a rejected optimistic add's
canonical records were themselves created optimistically and must go with the
node. The anti-re-mint mechanism is `layoutStore.withActor`: it stamps
actor-less operations at apply time, so the microtask-deferred layout change
carries a non-`user-` actor and the layout mint port's `startsWith` gate
rejects it — the bracket alone cannot reach that deferred delivery.

The layout store is a renderer module and the crdt modules deliberately do not
import the renderer (`mintPortWiring.ts` takes the store's seams injected),
so `createPendingRevertNodeRegistry` in `pendingOpRevert.ts`
takes `withActor` and `getGraph` injected, and `AgentPanelRoot.vue` — which
already imports `layoutStore` to inject `layoutChanges` the same way —
supplies them. Owning a renderer import inside crdt/ was rejected: it would
break the one seam rule that keeps every crdt module unit-testable without the
renderer.

The closure also detects refusal: `LGraph.remove` silently declines a node
with `ignore_remove`, so the closure re-reads `getNodeById` after removing and
reports `refused` (reportError, and no "undone" claim to the user) when the
node survived. A null graph at revert time reports `unavailable` via
`reportError` rather than a silent no-op. The no-re-mint pin runs against the
REAL layout store (renderer-located, per `layoutStoreMintDelivery.test.ts`):
drive an actor-less `deleteNode` through the removal path, flush the real
microtask delivery, and assert the sender received nothing — plus a control
proving the same removal without `withActor` DOES mint, so the pin can fail.

**5. Surface reverts to the user with one toast per microtask turn** via
`useToastStore().add(...)` from `useAgentCrdtFollower.ts` (the store is the
established out-of-component toast seam, e.g. `missingMediaPipeline.ts`, with
`st()` fallbacks), severity `warn`. One settle can emit two `reverted` events
(`failed` and `unprocessed` from the same batch), so toasts coalesce on a
microtask into one. The message never overclaims: when at least one node was
actually removed it reads `toastMessages.agentSyncEditReverted` ("Your edit
couldn't be synced and was undone."); otherwise — including an
`ignore_remove` refusal — `toastMessages.agentSyncEditFailed` ("Your edit
couldn't be synced."). The applier itself stays UI-free.

**6. Treat `unconfirmed` as delivery unknown, never as rejection.** The sender
uses this state after a transmitted batch loses its workflow binding, when the
host may already have applied it. The tracker retains the pending entries, and
the sender retains their identities so a late result can settle them. Only an
explicit rejection can trigger the compensating canvas revert.

### Alternatives considered

- **Consumer-side opId → Op map built from `onBatchMinted`** (leave the event
  as ids only). Rejected: duplicates ledger state and must mirror its whole
  lifecycle (`cleared`, `skipped_cleared`, `reset`) or leak; drift between the
  two maps would mis-target removals.
- **A revert hook on `mintPortWiring.ts`.** Rejected: the mint ports are the
  edit→op direction and have no settle-side knowledge; threading the tracker
  through them couples the two directions the current seam deliberately
  separates, and the pinned regression test's composition (wiring receives
  only `enqueue`) would still not exercise it.
- **Embedding removal inside `pendingOpTracker.ts`.** Rejected: the tracker is
  a pure, exhaustively unit-tested ledger orchestrator with no graph access;
  giving it one makes it untestable in isolation and violates the plain-data /
  systems split (ADR-ECS-0008).
- **Routing the removal through the store command path as a normal delete.**
  Rejected for the first pass: a command-stream delete is the semantics of "the
  user deleted a node that exists", including undo-stack participation and
  (without extra guards) a minted `delete_node`. A rejected add was never
  accepted anywhere; local-only teardown mirroring the materializer's
  divergence-repair path is the truthful operation. Revisit if later op kinds
  need before-state restoration, which the command layer is better placed to
  capture.
- **Covering all op kinds now.** Rejected: each non-add kind needs its own
  before-state capture design; blocking the shipped orphan-node bug on that
  design buys nothing, and the widened event makes the extension additive.

## Consequences

### Positive

- A rejected optimistic add converges local state back to authoritative state
  instead of diverging silently; the user is told.
- The `reverted` event becomes actionable for future op kinds without further
  contract changes.
- The applier is a pure-ish unit testable against a fake graph, and the pinned
  regression test exercises the exact production composition.

### Negative

- `PendingOpTrackerEvent`'s shape changes; `pendingOpTracker.test.ts` and the
  dev-panel log payload change with it (dev-only surface).
- Reverts of `connect` / `set_widget` / `delete_node` / `clear` still leave
  stale optimistic state (unchanged from today, now with a toast); this ADR
  accepts that gap knowingly.
- Local-only teardown bypasses the undo stack: after a revert, redo/undo
  history referencing the removed node may no-op. Accepted — the alternative
  (command-stream delete) records history for an edit the user did not make.
- Edits the user made to the doomed node between mint and rejection (links,
  renames, widget values) are destroyed with it; their own pending ops settle
  as independent no-op reverts. Accepted: the node never existed
  authoritatively, so nothing hung off it either. Batch coherence holds — a
  rejected add plus an unprocessed connect in one batch both revert, and
  `LGraph.remove` tears the optimistic link down with the node.

### FE-2504 deletion boundary

When remote and local Agent operations share one provenance-aware semantic
`LGraph` path and no store-to-canvas reconciliation remains, delete
`pendingOpRevert.ts`, its actor/suppression wiring, and the materializer-shaped
tests. Keep the transport ledger only for delivery, acknowledgement, and
effect correlation. A future implementation must not generalize this applier
into compensating canvas logic for every operation kind; that would deepen the
architecture FE-2504 is removing.

## Notes

The mint-suppression subtlety in Decision 4 is the load-bearing risk: the
bracket-vs-microtask gap is easy to reintroduce, and only `withActor`'s
apply-time stamping survives the deferred delivery. The real-layout-store
no-re-mint pin (with its would-have-minted control) is part of the definition
of done, not an optional hardening.
