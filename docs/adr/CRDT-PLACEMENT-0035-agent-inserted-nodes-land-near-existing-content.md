# ADR-CRDT-PLACEMENT-0035: Agent-Inserted Nodes Land Near Existing Content

Date: 2026-09-19

## Status

Proposed

Amended 2026-09-24 by
[FE-2504](https://linear.app/comfyorg/issue/FE-2504/agentcrdt-remove-store-first-remote-apply-and-every-reconciliation):
the trigger, offset, and pure decision function are unchanged; the seam moved
from `graphMutations`' prepare/commit batch and its `SemanticPlacementPort` to
`LiveGraphApplier.#placeBatch`, which runs after each frame's nodes are created
on the live graph.

## Context

The in-app agent inserts nodes through the CRDT follower: the server emits
`add_node` operations whose `pos` values are computed remotely — for a
workflow template, from the template's own baked-in absolute layout. The
follower creates the live node at the document's `pos` verbatim. Nothing
between the wire and the canvas considers what is already there or where the
user is looking.

When the canvas already has content (a LoadImage node the user just placed),
an inserted template can therefore land thousands of pixels away from
everything else. The nodes exist and render, but as an island the user cannot
see and does not know to hunt for. The human-driven "load template" flow never
hits this because it replaces the whole canvas.

Forces that constrain where a fix can live:

- **The server cannot know the client viewport.** Placement relative to what
  the user is looking at is inherently client information. The server _can_
  place relative to existing doc content (it holds the document), and a
  server-side improvement is worth pursuing in the service that computes
  `pos` — but the frontend cannot rely on every writer, every version, doing
  so. A client-side invariant is correct regardless of what the server sends.
- **The layer rule.** The follower lives in `src/workbench/`, and the layered
  architecture (`eslint.config.ts`, `import-x/no-restricted-paths`) forbids
  workbench importing from `src/renderer/` — which is where the viewport lives
  (the canvas's `DragAndScale`). Node geometry is readable from the live
  `LGraphNode` (`pos`, `size`) without crossing that line; the viewport is
  supplied through a dependency implemented at the composition root
  (`AgentPanelRoot.vue`).
- **Post-insert layout is already local-first.** Node moves are never minted
  into the document, and the applier excludes `pos`/`size` from in-place field
  sync (`SYNCED_NODE_FIELDS`). A node's doc coordinates matter once, at
  insertion; afterwards each client owns its local geometry. Any fix that
  adjusts placement locally is therefore consistent with the system's existing
  convergence model, not a new kind of divergence.
- **Batches are visible at one choke point.** `LiveGraphApplier.applyChanges`
  handles one delivered frame and knows which nodes it created, so a
  batch-wide decision (one shared offset) has a natural home.

## Decision

Enforce a client-side invariant at the follower's apply path: **a batch of
agent-inserted new nodes must land within reach of the content the user
already has.** Concretely:

### Seam

`LiveGraphApplierDeps.viewportBounds()` is a renderer-owned callback implemented
in `AgentPanelRoot.vue`: it returns the canvas's `ds.visible_area` in canvas
coordinates when the displayed graph is the root graph the follower is bound
to, and `null` otherwise (no canvas mounted, or the user is inside a subgraph,
where the visible rectangle says nothing about where a root-graph batch
lands). The viewport participates only when known; otherwise the bounding-box
condition alone decides.

All decision logic is a pure function in workbench
(`src/workbench/extensions/agent/crdt/batchPlacement.ts`): given the existing
nodes' rects, the viewport rect (nullable), and the incoming batch's rects, it
returns a single `{ dx, dy }` or `null`. `LiveGraphApplier.#placeBatch` calls
it after a frame's nodes and links are on the graph, with "existing" being
every live node the frame did not create and "incoming" the nodes it did. The
offset is applied by assigning `node.pos` inside the same remote-provenance
scope as the rest of the frame, so the layout store records the move under the
remote actor and nothing mints it back.

Eligibility is "created by this pass". A node the frame only updated, or
recreated because its document `type` changed, is not moved. Catch-up
(`syncFromDoc`) uses the same `#placeBatch` for the nodes it creates: a client
that returns to a tab and finds nodes inserted while it was away places them
exactly as it would have had it received them live. A fresh client replaying
the whole document onto an empty canvas has no existing content and receives
no offset.

### Batch granularity

A batch is one applied doc frame. On the wire, one agent tool call's operations
travel together as a single `graph_ops` event and apply as a single frame —
verified against the recorded conversation corpus: a batched tool call
carries its multiple `add_node` ops in one `graph_ops` event
(`agent-rec-batched-ops.json`), while three separate sequential tool calls
arrive as three separate events (`agent-rec-three-sequential-adds.json`). A
template insertion is one tool call, so its nodes are one batch and their
internal layout is preserved by the single shared offset. Separate tool calls
are separate batches by design: each is independently subject to the trigger,
anchored to the then-current content (including nodes a previous batch
placed), which parks each new far insertion beside the growing cluster. Frame
coalescing in the follower's queue can only merge frames, never split one, so
a widened batch remains a single offset. Should a future writer split one
logical insert across frames, the pieces would anchor independently — an
accepted limitation of the frontend half; the server, which owns the split,
also owns not splitting.

### Trigger

Reposition only when all of the following hold:

1. The scope already contains at least one node before the batch. An empty
   canvas keeps the template's own layout, matching the human template flow.
2. The incoming batch's bounding box is disjoint from the existing graph's
   bounding box inflated by `DISCONNECTED_GAP_PX` (600). Content placed near,
   overlapping, or interleaved with existing content is never touched.
3. The incoming bounding box does not intersect the current viewport, when a
   viewport is known for this scope (see `viewportBounds` above). Content the
   user can already see is not "lost", so it stays where the writer put it. An
   unavailable viewport does not veto: condition 2 alone decides.

The anchor is existing content, not the user's current viewport — an explicit
choice. Landing beside the nodes the batch relates to keeps the association
visible once the user finds either; centering on wherever the user happens to
have parked the viewport could drop a template into empty space unrelated to
anything, and requires a viewport that background-workflow applies do not
have.

The rule applies to every agent `add_node` batch, single- or multi-node. The
geometric predicate — disjoint beyond the gap _and_ offscreen — is the actual
discriminator between "lost" and "deliberate"; node count is only a proxy for
it, and a single far offscreen node is exactly as lost as forty.

### Offset

One translation for the whole batch: move the batch's bounding box so its
left edge sits at the existing bounding box's right edge plus
`PLACEMENT_GUTTER_PX` (80), top edges aligned. The batch's internal relative
layout is preserved exactly — never per-node moves, no collision search, no
grid snapping. Both constants are conservative product heuristics, chosen so
that only unambiguously lost content moves; they are named constants in
`batchPlacement.ts` and trivially tunable.

### What is deliberately not done

The shared document is untouched. The offset is a `node.pos` assignment inside
the frame's `agent-remote` provenance scope; the doc-op minter mints from
`local` graph intents only and never from moves, so there is no echo, no wire
change, and no protocol change. The doc keeps the server's coordinates.

### Alternatives considered

- **Server-side fix only** (in the private cloud service that computes
  `pos`). Right place for content-relative placement — it sees the document —
  and worth doing as a follow-up there. Rejected as the _only_ fix: the
  server can never see the client viewport, other and older writers exist,
  and the client invariant stays correct under any server behavior. The
  frontend change does not mask that work; it is the half only the client
  can do.
- **Renderer-layer post-processing after the frame.** Repositioning after
  the frame's provenance scope has closed and the canvas has drawn means
  visible double-placement, and a second stream of move operations whose
  provenance is wrong: a local-actor move is attributed to the human. It also
  splits placement across two modules.
- **Importing renderer geometry directly in the applier.** Forbidden by the
  layer rule; the rule is why `viewportBounds` is an injected dependency.
- **Minting corrected positions back into the doc.** Breaks the follower's
  "remote applies never re-mint" invariant, and two clients would race to
  correct the same batch with different answers.
- **Multi-node-only scoping.** Rejected above: count proxies the geometric
  condition the trigger tests directly.

## Consequences

### Positive

- Agent-inserted content is findable: it lands adjacent to what the user was
  working with, with the template's internal layout intact.
- The invariant is enforced at the single choke point every agent insert
  flows through, for any writer and any server version.
- The decision logic is a pure function with injected geometry, unit-testable
  without a renderer; the workbench module stays renderer-free and the layer
  rule holds without exceptions.
- No wire, protocol, or document schema change.

### Negative

- Local coordinates diverge from doc coordinates at insertion. Accepted:
  the system already treats post-insert geometry as local-first (moves are
  never minted, `pos` is never resynced), so this adds no new class of
  divergence — but it does mean two clients watching the same insert can see
  the batch in two places until someone arranges it.
- A fresh client replaying the full document onto an empty canvas has no
  pre-existing content to anchor to, so it sees the original scattered
  layout. The durable cure for the document itself is the server-side
  follow-up.
- Catch-up places the nodes it creates against whatever is live at that
  moment, so a client that receives an insert live and one that receives it on
  tab return can offset the same batch differently if their canvases differed.
  Accepted: post-insert geometry is already local-first.
- The gap and gutter values are heuristics. Chosen conservative so only
  clearly-lost content moves; a legitimate placement between 0 and 600 px of
  gap is never touched, and anything visible on screen is never touched.
- Existing-node bounds are the live nodes' `pos`/`size`, which for a node
  created earlier in the same frame is its configured size before first
  render (see the measurement amendment in
  [ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md));
  the error is bounded and the gutter absorbs it.

## Notes

- The offset is a `pos` assignment on a node that already exists, so it
  reaches the layout store as an ordinary `moveNode` operation stamped with the
  remote actor — no new `LayoutOperation` kind, consistent with the command
  contract of
  [ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md).
- The follower boundary this decision lives inside is described by
  [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md).
- The decision function is covered by `batchPlacement.test.ts`; its wiring
  through the applier by `liveGraphApplier.test.ts`.
