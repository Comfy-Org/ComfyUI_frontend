# 0024. Graph Activation and Document Objects for In-App Agent Targets

Date: 2026-08-28

## Status

Proposed

## Context

The In-App Agent can continue working on workflow A while the user views and edits
workflow B. The active canvas is therefore a presentation choice, not the address of
an agent mutation. A follower that samples the active graph at apply time can write A's
remote effects into B. A single process-local follower also cannot isolate two agent
targets or retain work for a target whose graph is not currently loaded.

The missing abstraction is larger than an offscreen queue: a workflow graph needs to be
a first-class domain document that exists independently of a tab and renderer. Activation
then becomes an explicit binding between that document and the active canvas. This ADR is
the self-contained frontend contract for target routing, document ownership, and lifecycle;
its requirements do not depend on access to a separate program repository. Its
target-routing and offscreen-queue rules align with the cross-repository contract recorded
in the program repository's
[ADR-015](https://github.com/christian-byrne/in-app-agent-program/blob/f3175059413d3ce4d22f53fc2b77107b475f9afb/decisions/ADR-015-target-graph-addressing-and-offscreen-queues.md).
That ADR uses canonical wire `workflow_id` as the V1 agent frame target; this frontend ADR
keeps a separately minted `document_id` for local document ownership and maps cloud-backed
documents to their `workflow_id` explicitly.

The current `ChangeTracker` is important prior art. It stores serialized state during
tab deactivation, allowing transient graph state to survive a tab switch, but its
`captureCanvasState()` guard is intentionally active-workflow-only. That is a useful
compatibility boundary, not a document model: offscreen remote application must not be
silently discarded because no canvas is active.

The design also follows the existing ECS direction. Dedicated stores own increasing
shares of graph state, while LiteGraph classes remain compatibility shells and render
targets. [ADR-0003](0003-crdt-based-layout-system.md) keeps durable layout in a separate
frontend-owned Y.Doc, and [ADR-0008](0008-entity-component-system.md) separates graph
identity, components, systems, and rendering. The document object composes those pieces;
it does not create a second ECS or a second CRDT applier.

## Decision

Introduce a document-owned graph domain model. Make activation an explicit state
transition from a document to a canvas binding, and route every agent or remote mutation
through the target document's ECS/domain stores whether or not that document is active.

### Document object

`GraphDocument` is the frontend's first-class workflow entity. Every document has a
stable frontend-owned `document_id`, including local and unsaved workflows. A cloud-backed
document may also have a `workflow_id`, which is the canonical wire address used by agent
commands and host frames. The document registry maintains the optional
`workflow_id` → `document_id` mapping and rejects duplicate or stale mappings. Local-only
documents are first-class documents but are not agent-addressable until a cloud
`workflow_id` is assigned. A nested `GraphId`/graph scope identifies a graph inside the
workflow document, not a second top-level document. Subgraphs remain domain scopes within
the same document.

The document owns or references the following state:

```text
GraphDocument (stable document_id, optional cloud workflow_id)
├── lifecycle: created | loaded | closed
├── persistence: unsaved | clean | dirty
├── graph-scope registry and ECS/domain stores
├── document-owned ChangeTracker and persistence baseline
├── target session: follower Y.Doc, state vector, sequence, lineage, queue
├── FE-owned layout Y.Doc (separate semantic document)
└── zero or more tab/view bindings
    └── at most one active canvas binding at a time per active-canvas policy
```

Lifecycle and persistence are independent fields. `created`, `loaded`, and `closed`
describe document existence. `unsaved`, `clean`, and `dirty` compare a document with its
persistence baseline. A successful save establishes a clean baseline, while a later
human or remote domain mutation makes the loaded document dirty. Both fields are
independent of whether a renderer is attached:

```text
created + unsaved ──load/hydrate──> loaded + unsaved/clean
                                          │
                                     domain mutation
                                          ▼
                                    loaded + dirty
                                          │ save
                                          ▼
                                    loaded + clean
                                          │ explicit close
                                          ▼
                                    closed + clean
```

Persistence state is not permission to mutate the graph. A mutation transitions
`clean → dirty`; `unsaved` remains unsaved while accumulating changes. Closing a dirty or
unsaved document requires an explicit save or discard decision. Closing removes
domain/render bindings only after that decision. A target session may remain detached
and retain a bounded queue after a document is closed; it must not be mistaken for a new
document or silently redirected to the active tab.

A tab is a view binding that names a `document_id`; it does not own document identity,
ECS stores, CRDT state, or persistence. A document may have no tab while it is queued,
being hydrated, or being used by a headless agent target. A tab switch changes a view
binding and may request activation; it does not implicitly select the target of a
remote frame.

The document's `ChangeTracker` becomes the owner of change history and save dirtiness.
Activation may connect the active-canvas event hooks, and deactivation may flush the
active view snapshot, but neither operation transfers tracker ownership. The existing
active-only tracker APIs remain compatibility APIs for user gestures; document-targeted
remote application must use a target-aware tracker seam that records the document's
new state and provenance rather than calling an inactive tracker and returning early.
Whether a remote effect is user-undoable is an explicit source policy, not an accidental
consequence of canvas focus.

Every committed domain mutation increments the document's monotonic `revision`. A save
captures `{ revision, serializedBytes }` before starting I/O. Completion advances the
persistence baseline to that captured revision only; the document becomes clean only if
its live revision still equals the saved revision. Mutations, including remote frames,
that commit while the save is in flight therefore leave the document dirty and cannot be
mistaken for saved bytes. Close and discard decisions are compare-and-set operations over
an exact revision: if the live revision changes after the decision is presented, the
decision is stale and must be requested again rather than closing newer state.

### Activation is a domain-to-view transition

Activation is an explicit operation, for example `activate(document_id, canvas)`, with
the inverse `deactivate(document_id, canvas)`. It is not a side effect of tab focus.
The transition validates that the document is loaded, resolves its graph scopes, and
then attaches only view concerns:

- the renderer/canvas binding and its render-facing compatibility projection;
- render-attached caches and transient measured geometry;
- the active view's viewport and subgraph-navigation projection; and
- active input/event hooks and awareness presentation for that view.

The transition does not reseed or replace the semantic follower Y.Doc, recreate the ECS
stores, mint IDs, rewrite workflow data, or infer a remote target from the canvas. On
deactivation, the document remains loaded and its domain stores, follower, queue,
change tracking, persistence, and agent subscription continue to operate. A deactivated
document must continue to support:

- ECS/domain mutations, including agent effects and human mutations delivered through
  the document mutation API;
- host-produced CRDT frame application and target-scoped state-vector recovery;
- document dirty-state and undo/redo bookkeeping; and
- serialization, save, and reload without a renderer.

Activation requests use a monotonic generation owned by the active-canvas binding. A new
request cancels any older in-flight request. Each request hydrates and validates its
document without changing the current binding, then checks its generation before a single
ordered handoff: detach the previous document's view hooks, attach the new document's
projection and hooks, and publish the new active binding. A stale or cancelled request may
clean up its private staged work but cannot detach, attach, or publish. Thus a late
`activate(A)` completion cannot overwrite a later `activate(B)` request, and deactivation
always belongs to the same serialized handoff as the activation that replaces it.

Selection, hover, viewport, awareness, and DOM measurements are view/presence state.
They do not become semantic document state merely because activation changes.

```text
tab focus / explicit activate
             │
             ▼
     ┌─────────────────┐       render projection
     │ GraphDocument   │ ─────────────────────────> canvas
     │ ECS + tracker   │                              │
     │ follower + queue│ <── explicit deactivate ─────┘
     └────────┬────────┘
              │ remains alive without canvas
              ├── CRDT apply / replay
              ├── target ECS mutation
              ├── dirty + persistence
              └── save / reload
```

### Agent targeting and application

Every remote or agent mutation batch carries the explicit canonical `workflow_id` at
the command, document-frame, and adapter-dispatch boundaries. The frontend resolves it
through a target-session registry. It never substitutes `canvasStore.rootGraphId`,
`app.graph`, the active tab, or another render-attached singleton.

```text
agent / host frame { workflow_id, ... }
                 │
                 ▼
       document/target-session registry
          ┌────────────┴────────────┐
          │ document A              │ document B
          │ follower + GraphScope   │ follower + GraphScope
          │ tracker + queue         │ tracker + queue
          └────────────┬────────────┘
                       ▼
             target ECS mutation path
                       │
             ┌─────────┴─────────┐
             │ active renderer  │ offscreen/headless
             │ downstream view  │ domain state only
             └───────────────────┘
```

For a loaded target, the target session applies the batch through the typed ECS/domain
mutation path even when its document has no active canvas. Rendering is a downstream
projection. A target mismatch, missing identity, or failed scope resolution is a loud
rejection with target-specific telemetry; it is never an active-canvas fallback.

The target session is a delivery and projection boundary, not a merge authority. Raw
Yjs updates flow host to follower only. Semantic operations remain owned by the shared
`@comfyorg/comfy-multi-player` applier, and their original
`[base_version, actor, op_id]` stamps are not regenerated, reordered, or replaced by
frontend command IDs. The separate FE layout Y.Doc remains separate from the shared
semantic document as required by ADR-0003.

### Unloaded-target queue and commit boundary

When a target document is not loaded, its registry entry becomes a detached target
session. The session queues complete host-produced, target-scoped document frames in
arrival order. The queue is not a second op log, does not derive `add_node` payloads,
and never contains raw Yjs updates exchanged between independently edited documents.
It preserves the frame's target, lineage, sequence, and semantic provenance, including
the original operation stamps when present.

Queue application has one observable commit boundary:

1. Validate target identity and lineage and stage the next frame against the target's
   last committed follower state.
2. Project the staged result and validate the target ECS/domain mutation.
3. Commit the follower state, ECS/domain effects, document change-tracker update, and
   applied sequence/state-vector advancement together.
4. Remove the frame from the queue only after that commit succeeds.

The implementation uses one document-scoped commit coordinator and a stable frame commit
ID. Prepare builds immutable next snapshots for the follower, ECS/domain stores,
`ChangeTracker`, state vector, and applied sequence in private revision-keyed slots. Under
the document's write lock, the coordinator validates that the starting revision is still
current, then advances one document-level committed-revision pointer. Every owner resolves
its visible snapshot through that pointer, so this single assignment publishes the whole
tuple; no owner may independently expose a staged revision. Queue acknowledgement happens
only after the coordinator records that commit ID as published.

If prepare or validation fails, all staged snapshots are discarded. Failure before the
pointer advance leaves the prior tuple visible, the frame queued, and its sequence and
state vector unacknowledged. If process failure makes publication status uncertain,
recovery compares the stable commit ID and committed-revision pointer. It either recognizes
the fully published tuple or discards private staging and idempotently reapplies the queued
frame; mixed tuples are never advertised. The implementation may use a staged follower
clone or an equivalent replayable checkpoint, but partial component commits are not a
valid observable state.

The queue is bounded. On overflow, process restart, or loss of a detached session, the
frontend retains the last committed target state vector and resubscribes for that
target's delta. Any delivery frames beyond that boundary are discarded only as a
recoverable transport buffer, never as accepted mutations. Ordinary replay preserves
the follower document object and lineage. If the authority cannot provide the delta,
only an explicit `doc_reset`/snapshot lineage break may replace it, after reset is
dispatched to every document-store and projection consumer.

### Reconnect, replay, and node incarnation

Each target session has independent sequence, state-vector, pending-effect, and lineage
state. A gap or reconnect for A must use A's state vector and cannot subscribe or replay
against B. Ordinary recovery applies the missing delta to the existing follower Y.Doc;
it never wipes or independently reseeds that document. A `doc_reset` is the sole
replacement path and starts a new lineage only after all projectors have observed the
reset.

DQ-11(c)'s `node_incarnation` is shared-applier payload data. The frontend carries it
through the document, queue, projection, and reload boundaries. It never infers an
incarnation from the active canvas, collapses it into a client ID, or mints a replacement.
A delete/re-add with the same node ID therefore cannot allow stale widget stamps from
the prior incarnation to affect the new target occupant. Retries preserve the original
`op_id`.

## Invariants

- **Stable target identity:** every document has a stable `document_id`; `workflow_id` is
  mandatory at agent command, frame, target-session, and adapter seams. Missing or
  unresolved cloud targets fail loudly; active-canvas fallback is forbidden. Local-only
  documents cannot receive agent frames until their `workflow_id` mapping exists.
- **Activation is presentation:** activation/deactivation attaches or detaches view
  concerns only. It does not alter semantic graph state, CRDT lineage, IDs, or merge
  authority.
- **Deactivated documents remain live:** ECS mutations, CRDT apply, change tracking,
  persistence, save, and reload work without a renderer or focused tab.
- **One target, one session:** each target owns its follower Y.Doc, scope resolution,
  queue, state vector, sequence baseline, and lineage. State never crosses target keys.
- **Host/follower direction:** the follower never writes the shared semantic Y.Doc;
  raw Yjs updates are host-to-follower only. The frontend has no second applier.
- **Replay safety:** queue removal and state-vector/sequence advancement happen only
  after the target domain effect commits. Ordinary gap recovery is state-vector delta
  replay, not a canvas or follower-document wipe.
- **Stamp preservation:** `[base_version, actor, op_id]`, `op_id`, and `node_incarnation`
  are preserved through retry, queue drain, reconnect, and projection.
- **Separate view state:** layout remains in the separate FE-owned Y.Doc; presence,
  selection, hover, viewport, and renderer measurements are not semantic shared state.
- **Byte-identical persistence:** the test first performs any node-ID reminting required by
  ADR-0018, serializes the normalized document with the production serializer, and captures
  those exact bytes as its baseline. It then deactivates/activates the document any number
  of times, saves, reloads, and serializes again with the same serializer. The final bytes
  must exactly equal the post-normalization baseline; no later ID normalization or
  comparison-time exception is permitted. Activation must not persist viewport or
  measurement artifacts. This is a hard Base/ECS/Nodes-2.0 QA invariant.
- **Loud illegal state:** invalid activation, scope resolution, projection, catalog, or
  widget state fails at the domain boundary and is observable; activation must not widen
  silent Nodes-2.0 widget-protocol failure surfaces.

## V1 API and ECS sequencing

This document does not change the V1 custom-node API surface. The document object is an
adapter around the current graph/domain boundary first, so V1 can ship non-breaking on
the existing codebase. The intended sequence is V1 API, at least two weeks of
stabilization, ECS, Nodes 2.0, and only then removal of the old graph compatibility
layer. Activation must not require a completed ECS rewrite, but every new agent or
remote mutation must enter through the typed document/ECS seam so the later migration
does not create an active-canvas-only API.

PR [#15721](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15721) is prior art for
this boundary: its graph-level atomicity audit found validate-before-mutate behavior at
the audited store call sites, while also documenting that ID minting and whole-graph
atomicity still have gaps. Target-frame application therefore needs the explicit staged
commit boundary above; it cannot infer transactionality from individual store actions.
PR [#15421](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15421) is prior art for
the repository-owned domain glossary and for separating current implementation facts
from planned architecture. This ADR uses that discipline for the document lifecycle:
the current `ChangeTracker` and compatibility graph are named as prior art, while the
document registry and target-aware tracker seam are the intended follow-up.

## Alternatives considered

- **Keep the active tab as the target** — rejected because tab focus is presentation and
  can redirect A's effects into B.
- **Add only an offscreen queue to the current singleton follower** — rejected because
  it leaves document identity, CRDT lineage, change tracking, and persistence coupled to
  one active graph.
- **Open/focus the target tab before applying** — rejected because correctness would
  depend on presentation, interrupt the user, and still fail for an unloaded target.
- **Use one mutable follower and switch its workflow ID** — rejected because state
  vectors, pending effects, trackers, and lineage can leak across targets.
- **Queue full-document replacements** — rejected because this clobbers concurrent
  edits and violates the op-based replication contract. Queue entries are target-scoped
  host frames with replayable commit boundaries.
- **Make the frontend a second merge authority** — rejected because the shared
  `comfy-multi-player` applier must remain the portable, deterministic authority.

## Consequences

### Positive

- Agent work remains attached to the intended document across tab switches.
- Offscreen and headless targets can receive, track, save, and recover mutations without
  stealing focus or requiring a mounted renderer.
- A stable document identity gives tabs, ECS stores, persistence, CRDT frames, and
  reconnect state one auditable ownership boundary.
- The same activation seam can support the V1 API, incremental ECS migration, and later
  Nodes 2.0 renderer replacement without changing the public custom-node contract.
- Explicit commit and replay boundaries make target isolation, byte-identical persistence,
  and DQ-11(c) incarnation handling testable.

### Negative

- The frontend needs a document registry and lifecycle in addition to its tab registry.
- The follower and tracker must become target-aware, and detached queues need bounds,
  telemetry, registration, and resync behavior.
- Existing active-only `ChangeTracker` calls and active-canvas invalidation need a
  compatibility migration; they cannot be reused for offscreen remote effects.
- Staged projection and byte-identical save/reload checks add implementation and QA
  work before old graph compatibility code can be removed.

## References

- [ADR-0003: Centralized Layout Management with CRDT](0003-crdt-based-layout-system.md)
- [ADR-0008: Entity Component System](0008-entity-component-system.md)
- [Change Tracker](../architecture/change-tracker.md)
- [ECS Target Architecture](../architecture/ecs-target-architecture.md)
- [Subgraph Boundaries and Widget Promotion](../architecture/subgraph-boundaries-and-promotion.md)
- [PR #15721: graph-level atomicity audit](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15721)
- [PR #15421: canonical architecture knowledge and domain glossary](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15421)
- [Program ADR-015: target-graph addressing and offscreen queues](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-015-target-graph-addressing-and-offscreen-queues.md)

## Glossary

- **Activation** — explicit attachment of a loaded document to the active canvas and
  its renderer/view state; it is not tab focus itself.
- **CRDT** — conflict-free replicated data type; here the host-produced Yjs semantic
  workflow document and the separate FE-owned layout document.
- **Document object / `GraphDocument`** — first-class workflow domain entity keyed by a
  stable frontend `document_id`, independent of tabs and renderers; cloud-backed documents
  additionally map a canonical `workflow_id` for agent addressing.
- **ECS** — Entity Component System; the frontend direction in which dedicated stores
  own graph data and systems own behavior, with LiteGraph as a compatibility projection.
- **Follower** — receive-only frontend replica that integrates host-produced Yjs updates.
- **Graph scope / `GraphId`** — identity for a graph within one workflow document,
  including nested subgraphs; it is not a top-level workflow identity.
- **Host** — authoritative process using the shared `comfy-multi-player` applier to
  apply semantic operations and produce follower updates.
- **Lineage** — history identity of a document; an explicit `doc_reset` starts a new
  lineage and is the only ordinary follower-document replacement path.
- **`node_incarnation` / DQ-11(c)** — stamp namespace distinguishing a node after a
  delete/re-add from its prior occupant with the same node ID.
- **Pending-effect queue** — bounded, target-scoped delivery buffer whose entries are
  not acknowledged until follower, ECS, tracker, and replay state commit together.
- **State vector** — Yjs summary of updates known by one follower, used for target-scoped
  delta replay after reconnect or queue recovery.
- **Target session** — one registry entry for a document's follower, scope, replay state,
  lineage, and pending queue.
- **View/presentation state** — renderer, viewport, selection, hover, awareness, and
  measurements that may attach to a document but are not semantic workflow state.
