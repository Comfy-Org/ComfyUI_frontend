# ADR-GRAPH-DOCUMENT-0026: Frontend Document Model

Date: 2026-08-31

## Status

Proposed

## Context

### The app has views, stores, and events — but no document

This ADR salvages the general document-system proposal from
`origin/adr/frontend-document-model` (`8606edcbb7`, authored by
Ben Cooley) after its original `0018` number collided with the already-merged
[ADR-CRDT-MINT-0018](CRDT-MINT-0018-merge-identity-for-node-transfers.md). It now lives as
ADR-GRAPH-DOCUMENT-0026.

[ADR-GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md) remains the agent-specific
`GraphDocument` and activation contract for offscreen targets, queues, and
CRDT follower recovery. This ADR is the broader frontend document model that
explains why workflow identity, lifecycle, sidecars, and event routing need a
first-class document owner at all. [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
continues to govern the CRDT follower and distribution boundaries.

A traditional multi-document editor (VS Code, Photoshop, any word processor)
is built on five pieces: a **document** object per open file that owns its
editing session (content, undo, selection, caches); a **view** that displays
one document at a time; a **document manager** that owns the open list, the
active pointer, and the lifecycle (`open`/`activate`/`close`); **event
routing** that delivers async results to the document they belong to; and
**commands** addressed to documents. Switching tabs is a pointer swap —
nothing is destroyed.

ComfyUI_frontend has the view, the stores, and the events, but not the
document:

- There is exactly **one root `LGraph` and one `LGraphCanvas`** for the
  app's lifetime, created once in `ComfyApp.setup` in `src/scripts/app.ts`.
  (Subgraphs are separate graph objects the canvas pointer-swaps into — the
  mechanism Phase 5 generalizes.) A
  workflow tab switch does not swap a pointer; it serializes the outgoing
  workflow to JSON, calls `rootGraph.clear()`, and rebuilds the incoming
  workflow into the _same_ graph instance via `rootGraph.configure()`. Every
  node object is destroyed and recreated on every switch.
- Isolation between tabs is achieved after the fact by `ChangeTracker`
  (`src/scripts/changeTracker.ts`), which snapshots an **allowlist** of state
  around the demolition: graph JSON, undo/redo queues, viewport, node
  outputs, subgraph navigation. Anything not on the allowlist is either
  destroyed with the graph or — worse — leaks into the next workflow.
- Per-workflow state otherwise lives in **process-global containers**: the
  `app` singleton (`nodeOutputs`, `nodePreviewImages`), and a dozen-plus
  Pinia stores (`executionStore.nodeProgressStates`,
  `executionErrorStore`, `canvasStore.selectedItems`,
  `domWidgetStore`, title editor state, …) that describe "whatever is
  currently on screen".

### Evidence that the allowlist model is failing structurally

The maintenance history of the snapshot/restore system is the bug tracker:

- **Every preserved item is a hand-built special case.** Node preview blob
  URLs needed a dedicated per-workflow stash
  (`nodeOutputStore.stashedPreviews`, PR #15360) because `app.clean()`
  revoked unrecoverable websocket-delivered blobs. Missing-node/model/media
  warnings needed a `pendingWarnings` cache on `ComfyWorkflow`. Subgraph
  viewports needed a separate LRU keyed `${workflowPath}:${graphId}` with an
  `isWorkflowSwitching` flag to stop it caching mid-transition state.
- **The system needs guards against itself.** `ChangeTracker.isLoadingGraph`
  exists because between `configure()` and `afterLoadNewGraph` the graph
  holds the _new_ workflow while `activeWorkflow` still points at the _old_
  one; a capture in that window corrupts the outgoing workflow's state. It
  has its own regression test (`browser_tests/tests/changeTrackerLoadGuard.spec.ts`),
  `isActiveTracker()` assertions, and a debounced `squashState` that re-checks
  both guards because the debounce can land after a switch.
- **Unlisted state is a live bug class.** Run/validation errors are destroyed
  on every switch and never restored. Selection is not snapshotted — and
  because `LGraphCanvas.setGraph` early-returns when already on the root
  graph, canvas ephemeral state (selection, hover, in-flight link drag)
  _leaks into the next workflow_ as references to destroyed nodes. Execution
  progress is a single flat record (`executionStore.nodeProgressStates`), so
  a run queued in tab A highlights same-numbered nodes in tab B.
- **Four hand-rolled scoping implementations exist, using two different
  keys.** `widgetValueStore` and `previewExposureStore` key by root-graph id;
  the preview stash keys by workflow _path_; PR #15361 keys execution errors
  by root-graph id. Path breaks on rename (see the compensating
  `moveDraft`/`moveWorkflowThumbnail` bookkeeping in
  `workflowStore.renameWorkflow`). `LGraph.resetAfterClear()` purges the
  graph-keyed Pinia stores and reassigns the root graph's `id`, so those
  stores lose their data on every tab switch. Graph id also collides for
  files copied outside the app (the UUID travels inside the JSON; only
  in-app flows like `duplicateWorkflow`/`saveAs` regenerate it).
- **There is no close lifecycle.** Nothing tells a subsystem "this workflow
  is gone; release its resources". PR #15361 leaks a small bucket per failed
  graph because it had nowhere to evict; PR #15360 hand-routed its release
  through `closeWorkflow()`. Additionally, `syncWorkflows` silently
  `unload()`s any _background_ tab whose file changed remotely
  (`src/platform/workflow/management/stores/workflowStore.ts:451`),
  destroying its undo history and session state with no event fired — an
  exit-from-existence path that bypasses any close hook.
- **Async results are addressed to the screen, not to a workflow.** Four
  separate `executed` listeners exist (`app.ts`, `changeTracker.ts`,
  `executionStore.ts`, `linearOutputStore.ts`). The `app.ts` listener
  resolves against the active graph; the `changeTracker` listener is
  already job-attributed but then writes into the resolved workflow's
  (possibly inactive) tracker — attribution without a safe destination.
  The correct attribution layer already exists —
  `executionStore.jobIdToWorkflow` et al. — and a correctly job-keyed twin
  of the progress record exists (`nodeProgressStatesByJob`) but the UI reads
  the global one.

### Forces

- PR #14941 (layer-editor UX fixes) includes a `workflowTransientState`
  provider registry generalizing the `ChangeTracker` swap
  (`{snapshot(): unknown, restore(state): void}`). The TDD
  "Per-workflow transient state — scoping vs snapshot/restore" argues for
  graph-scoped keys plus explicit eviction instead. Both positions are
  partial: the registry is two phases of a lifecycle with no close, no
  dispose, and no identity; scoped keys are the data half of a document with
  no event half.
- The legacy custom-node surface (`app.graph`, `window.graph`,
  `LiteGraph`/`LGraph` window globals, `/scripts/app.js` shims, and the
  extension hooks, every one of which receives the `app` singleton) is de
  facto frozen and
  regression-gated by the registry census matrix. Any architecture change
  must present the old surface as a facade. The facade pattern is already
  deployed and relied on by shipping code in three places: the deprecation
  getters on `ComfyApp` in `src/scripts/app.ts`, the `LGraphNode.pos`/`size`
  proxies over the layout store, and the in-development v2 node API
  prototype, which is parameterized on a graph-supplier _thunk_ rather than
  a graph reference.
- The ECS target architecture (ADR-ECS-0008 and
  `docs/architecture/ecs-target-architecture.md`) already states that runtime
  state must be scoped per workflow instance. This ADR supplies the identity
  and lifecycle infrastructure that direction requires, without waiting on
  it.
- There may ultimately be more than one document type in the app — for
  example, a layered PSD-like image editor. The document model should be
  able to support that without being rebuilt. Embedded mini-editors already
  in-tree (the mask editor, the layer-editor compositor whose cache
  motivated PR #14941) hint at where such types would come from.

## Decision

We introduce a general **document system** for the frontend: typed
documents with identity, lifecycle, and ownership rules, defined by five
invariants, and phased in. Its first — and initially only — type is
`workflow`, and the phases below are the workflow migration. The typed
aspect is aspirational — where the model is heading, not a day-one
deliverable — but the shared machinery (uid, lifecycle bus, key helper,
sidecar contract) is designed so nothing in it assumes workflows, so a
second type is an addition rather than a rebuild.

The invariants are stated firmly but adopted as **guidance, not
enforcement**: they describe the target shape — how we think about the
system as it is, and where and how we change it. New code should follow
them; existing code migrates opportunistically along the phases below; they
harden into enforced rules only as the mechanisms that make them cheap to
follow (the uid, the bus, the container) actually land. The near-term
commitment is deliberately small — a session uid
and a lifecycle event bus — because those two alone convert the recurring
bug class from "silent corruption" into "correct by construction" for every
subsystem that adopts them.

### What a document is

A document is one editing session of one piece of user content. It is
distinct from the **file** (path + content on disk — today's
`ComfyWorkflow`/`UserFile`, which persists across opens and lives in the
directory listing) and from the **view** (the surface that displays it).

Every document has a **type** — aspirational today, while the only type is
`workflow`, but it is where the model is heading. The identity, lifecycle,
and module machinery of this ADR (D1–D3, D5) is generic over type; what a
type defines is its
core data schema (D4), its hydration/dehydration format, its view binding,
and any legacy facade surface. This ADR specifies one type — `workflow` —
and deliberately designs that machinery so that others (for example subgraph
blueprints, or a layered PSD-like image document) could become document
types later without changes to the manager, the uid rules, or the sidecar
contract. Designing those types is out of scope here.

A **workflow document** owns the session's data: the live graph
(eventually), undo/redo records, view state (viewport, subgraph stack,
selection), execution session state (outputs, previews, run errors, job
attribution), warnings, mode, and dirty flag. The systems that operate on
that data — the undo engine, execution routing, persistence — live outside
it (see D4).

### D1 — Identity: the session uid

Every live document has two identities with different lifetimes:

- The stable **document_id** names the user workflow target. It is the
  address ADR-GRAPH-DOCUMENT-0024 uses for `workflow_id` → `document_id` resolution, detached
  target sessions, bounded CRDT queues, lineage, state vectors, and remote
  frames. It survives tab/view closure for as long as a target session is
  intentionally retained, and reopening a workflow resolves to the same stable
  target when that retained session still exists.
- The ephemeral **uid** names one in-memory editing session. Runtime sidecars
  that only belong to the live editing session key by uid, but agent-targeted
  state first resolves `document_id` to the current live uid, if one exists. If
  no uid exists because the target is detached, the operation remains queued on
  the stable `document_id`; it is never redirected to the active tab.

Every live document uid has these invariants:

- **Minted at open** (hydration — where `changeTracker` is created today),
  **erased at close**. Reopening the same file creates a **new** uid.
- **Never persisted, never serialized.** This is the property the identity
  guarantee rests on: the embedded workflow JSON id collides because it
  travels with the file; the path breaks because it is a storage address. A uid that exists only in
  memory cannot inherit either failure — two opens are two uids, by
  construction.
- All runtime state keys by uid (or `${uid}:${graphId}` for
  subgraph-scoped state). Path and embedded JSON id are demoted to
  attributes: path for storage operations, embedded id for persistence-side
  concerns (duplicate-open detection, draft matching across reloads).

Because reopen mints a fresh uid, a missed eviction produces an _orphaned
bucket_ (a leak, sweepable by pruning buckets whose uid has no live
document) rather than _resurrected state_ (a visible bug). The failure mode
degrades from incorrect to inefficient.

### D2 — Addressing: events are stamped at ingress

Anything arriving on a push channel (websocket `executed`, `progress`,
`execution_error`, …) resolves its target document **via the job→uid map at
the point of ingress** — never via the active pointer. Consumers receive
addressed events. The active pointer is a display concern, never an
addressing concern. (The stronger form is stamping at the source: backend
PR comfyanonymous/ComfyUI#13643 adds `workflow_id` to all websocket
messages, and frontend PR #11951 gates handlers on it — both cold, both
still desirable. Ingress stamping requires no backend change and can ship
first.)

Two boundary cases: events with no job→uid resolution (page reloaded
mid-run, jobs queued by another client) go to an explicit _unattributed_
bucket rather than being applied to the active document by default — how
they are surfaced is a UI decision, but misdelivery is not the fallback.
And uids are per-JS-context: contention between two _browser_ tabs over
path-keyed persisted drafts is a persistence-layer concern outside this
ADR's scope.

### D3 — Lifecycle: one named event sequence, no unobserved exits

The document manager emits a small, centrally-owned phase vocabulary:

| Phase        | Guarantee window ("systems may assume")                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Open`       | Core hydration complete: uid minted, document data populated; view not yet attached                                |
| `PostOpen`   | Document fully constructed and registered; sidecars allocate their per-uid state                                   |
| `Activate`   | Document is becoming the presented one; when dispatch completes, its data is authoritative for what the view shows |
| `Deactivate` | Document ceasing to be the presented one; fully live; last chance to read view state                               |
| `PreClose`   | Document fully live; handlers may **veto or defer** (e.g. unsaved-changes dialog); skipped for forced closes       |
| `Close`      | Transition is fact; core releases document data                                                                    |
| `PostClose`  | uid is dead; sidecars release resources (revoke blob URLs, dispose caches)                                         |

Rules:

- **Every path into and out of existence routes through the lifecycle.**
  System-initiated deaths — the `syncWorkflows` background-unload of a tab
  whose file changed remotely, deletion of a temporary workflow — emit a
  **forced close** (`Close`/`PostClose`, no `PreClose` veto). A
  revert-from-disk is deliberately _not_ a distinct phase: it ends the
  editing session, so it is a forced close followed by a fresh `Open` when
  the document is next needed — consistent with D1 (reopen mints a new
  uid), and it turns today's silent trapdoor into an ordinary, observable
  death.
- Phases are **guarantee windows**: each documents what state handlers may
  assume, so handlers assume instead of defensively checking. Pre-events may
  influence the transition; post-events observe only.
- The vocabulary is **added to reluctantly and centrally**. A new phase is a
  reviewed API change with one-line documented semantics. Pre/post pairs are
  the sanctioned answer to cross-phase ordering needs — never priority
  parameters.
- Handlers may not trigger lifecycle transitions synchronously (no closing a
  document from inside `Activate`); transitions requested mid-dispatch are
  queued. Dispatch is synchronous at stable points; slow work (persistence,
  thumbnails) is deferred by the handler onto data it copied during the call.
- The one sanctioned exception to synchronous dispatch is the `PreClose`
  veto, which may require user input (the unsaved-changes dialog). Close is
  therefore a two-step protocol: `PreClose` handlers either allow, veto, or
  defer (returning a pending decision); a deferred close suspends the
  transition — the document remains fully live — and the requester re-issues
  or abandons the close when the decision resolves. `Close`/`PostClose`
  themselves are always synchronous and unvetoable.
- Late registration receives synthetic catch-up events in normal lifecycle
  order. For each existing document the bus emits `Open` then `PostOpen` while
  the view is still considered unattached; if the document is active, a
  synthetic `Activate` follows only after that allocation phase. Synthetic
  events are marked as catch-up, but their guarantee windows are the same as
  live events.
- **Transitions are serialized.** At most one transition pipeline runs at a
  time per document manager; transition requests arriving while one is in
  flight are queued. Coalescing is allowed only for redundant requests that
  preserve every required lifecycle event and never hide an exit from a
  sidecar; `switch(A→B)` followed by `close(A)` still observes `Deactivate`,
  `PreClose` when applicable, `Close`, and `PostClose` for `A`, and
  close-while-activating is serialized after the activation pipeline. The
  current switch path is a
  multi-await chain whose overlapping invocations are acknowledged in code
  comments (`workflowService.ts` idempotent-load guard); the bus must not
  inherit that ambiguity — guarantee windows are meaningless without a
  defined serialization rule.
- **Graph (re)loads are not document transitions.** Undo/redo and
  same-document reloads run the same `loadGraphData` path as tab switches
  today; the bus is gated on document _identity change_, never on graph
  load (see Phase 1). Applying a state to the current document is a system
  operation on document data, not a lifecycle event.
- Lifecycle events carry the document (uid **and type**). Once a second
  type exists, sidecars declare the document types they handle at
  registration (default: `workflow`) and events for other types are not
  delivered to them — keeping future document types from silently flowing
  through sidecars that assume graph semantics. Until then the field is
  carried but everything is implicitly `workflow`.

### D4 — Ownership: data lives with the document; systems live outside

A document is mostly **data** — plus only the behavior needed to manage
that data. The behavior a document does carry is chiefly its **mutators**:
the controlled write API through which its data changes. **Systems** and
**commands** — the code that implements capabilities — live outside the
document, usually as a single instance, and do the mutating, but through
the document's mutators, never by reaching into its fields. This gives
every document one write funnel: the single place where dirty-flagging,
undo capture, and change notification attach, instead of being
reimplemented in every caller. (In-tree precedent: node `pos`/`size` writes
are already routed through the layout store's mutations API rather than
written as raw fields — the same discipline, one level down.) Systems operate on whichever
document is current or addressed.
Undo/redo is the canonical example: there is one undo/redo _system_ (the
engine that captures, diffs, and applies), but the undo/redo _records_ it
operates on are document data, contained in or keyed by the document's uid.
The same split applies to execution routing, persistence, and selection.
Two corollaries: the document class does not accrete subsystem
implementations as methods (no god object), and a system is inherently
multi-document-ready — pointing it at a different document is changing an
argument, not swapping its internal state. (Today's `ChangeTracker` is the
counterexample that motivates the rule: one instance _per workflow_ that
fuses the records, the engine, and the switch sequencing — which is why
its identity gets used as workflow identity and why it must be split by
Phase 4.)

- **The document's session data lives in (or is keyed to) the document**,
  and its schema is defined per document type. For the `workflow` type: graph
  content, undo/redo, viewport + subgraph stack + selection, node
  outputs/previews (the data; see below), run errors, job list, warnings,
  mode, dirty flag.
- **Sidecar managers are external modules** whose state is keyed by document
  uid and driven by lifecycle events: the compositor layer cache, the
  preview blob-URL stash, thumbnails, draft persistence, Load3D viewers.
  Sidecars hold what is _about_ documents but not _of_ them — external
  resources, caches, cross-cutting services. Boundary rule of thumb: the
  document holds data you would serialize to hand the session to another
  window; sidecars hold handles you would have to rebuild or release. A
  sidecar releases those handles during `PostClose` while its uid-keyed bucket
  is still readable, then evicts the bucket before the phase returns. `Close`
  is for core document data becoming unavailable; `PostClose` is for external
  cleanup against the last visible sidecar state.
- **Pinia stores become managers, not owners.** A singleton store is a
  perfectly good _storage engine_ for per-document data — the way a single
  database engine serves many databases — provided every entry is keyed by
  document uid and each slice is conceptually one document's data. Stores
  then take one of two shapes: a sidecar (its own uid-keyed map, evicted at
  `Close` when it holds core document data, or at `PostClose` after release
  when it holds external resources) or a reactive facade exposing the active
  document's slice to components. What we stop adding — and
  migrate away from — is the third shape, the one that produced the bug
  class: a singleton holding a _single, unkeyed_ copy of "the current
  document's" data, overwritten in place on every switch. Keyed storage
  carries its natural obligations — eviction on close, sweeping orphaned
  entries — which is what D3's close events and the D1 orphan sweep exist to
  serve; those are requirements of the pattern, not defects in it.
- **Legacy globals become read-through facades** over the active document
  (`app.graph`, `app.nodeOutputs`, `window.graph` as a defined property).
  The key format of ecosystem-visible surfaces (bare node ids in
  `app.nodeOutputs`) does not change.

### D5 — Modules and ordering

Ordering is allowed to exist in exactly three places:

1. **Within a phase, the document's own data movement** — capturing view
   state on `Deactivate`, releasing session data on `Close`, populating it
   on `Open`: consecutive lines in the document object's lifecycle methods.
   The document (or its implementation) carries out this work itself; the
   manager's role is to drive transitions and dispatch events, not to
   contain the work. Order
   is editable by moving a line, visible in diffs, reviewed. (Today's
   `useWorkflowService().beforeLoadNewGraph` and
   `useWorkflowService().afterLoadNewGraph` are this pattern, unnamed and
   unsubscribable — and they conflate document-transition work with graph-load
   work, firing on every undo/redo as well as on switches. Only their
   document-transition half becomes the `Deactivate`/`Activate` implementation;
   see Phase 1.)
2. **Within a phase, sidecars**: FIFO — registered first, called first, the
   same order for every event. One registration per module (an object
   carrying all its handlers); duplicates throw; per-sidecar error isolation
   (one throwing sidecar cannot break a switch).
3. **Across phases**: the pre/post vocabulary of D3.

There are deliberately **no priority/before/after knobs**. If a sidecar
cares what order it runs in relative to a peer, a data dependency is being
smuggled in as temporal coupling; the fix is to promote the datum into the
document (core writes it, ordered by code; the sidecar reads it), or to have
the consumer read the producer's uid-keyed API from a _later_ phase. The
resident cautionary tale is the viewport race: `ChangeTracker.restore()`
sets `canvas.ds`, then `setGraph()` fires the subgraph-navigation watcher
(`flush: 'sync'`), which overwrites it — patched today with an
`isWorkflowSwitching` flag cleared by `setTimeout`. Under this ADR, viewport
is document data written once by core; the navigation cache is a sidecar
that reads it at `Deactivate`. No watcher, no flag, no timer.

### Alternatives considered

- **Provider registry (PR #14941)**: `{snapshot, restore}` is
  `Deactivate`/`Activate` with no `Close`/`PostClose` (cannot evict or
  dispose — snapshots holding blob URLs are never released), no `Revert`,
  and no identity (state addressed by "the active slot"). Not wrong —
  two phases of D3's seven. It may land `@internal` as a stopgap (see
  Phase 0).
- **Per-feature `ChangeTracker` fields**: O(features) hand-written pairs,
  core imports feature modules, and no fix for cross-tab misattribution
  while both workflows are live.
- **Keying by root-graph id or path**: both are attributes, not identity;
  see D1 for the concrete failure of each. Both remain in use _behind_ the
  uid for their legitimate jobs.
- **Waiting for ECS**: the ECS direction (ADR-ECS-0008 amendment: graph-scoped
  dedicated stores) is _strengthened_ by this ADR — those stores are
  currently sabotaged by graph-id recycling. D1/D3 are the identity and
  scoping foundation the ECS migration's own identity-scope audit calls
  for, available without the rewrite.

## Phased transition

The phases build the general document system while migrating its first
type, `workflow`. The presumption of this plan: **Phase 1 alone (uid +
lifecycle events) is very good and helps immediately.** Every later phase
is optional-in-timing and none requires reworking what earlier phases
build.

### Phase 0 — now, unblocking

Land the in-flight UX fixes (PR #14941, #15360, #15361/#15412). If the
registry lands, mark it `@internal` with a testable removal condition:
_deleted when the lifecycle bus exists and the compositor cache is its first
registered sidecar._

### Phase 1 — uid + lifecycle bus (the slice worth doing now)

- Add the session uid (a few lines on `ComfyWorkflow`: minted in `load()`,
  nulled in `unload()`; moves to the document class in Phase 4).
- Introduce the document lifecycle emitter with the D3 vocabulary, the D5
  registration contract, and the shared key helper
  (`${uid}` / `${uid}:${graphId}`).
- Split `beforeLoadNewGraph`/`afterLoadNewGraph` into their two
  responsibilities: graph-load work and document-transition work. They fire
  on every `loadGraphData` call —
  including undo/redo (`ChangeTracker.undo` calls `loadGraphData`,
  `changeTracker.ts:477`) and same-document reloads — so they cannot simply
  be renamed into `Deactivate`/`Activate`: a bus wired to them would emit
  false transitions on every undo step, and sidecars entitled by D3 to
  assume "Deactivate = document leaving" would corrupt state. The bus is
  gated on document identity change; the graph-load half of the hooks stays
  with `loadGraphData` as a system concern. This disentangling is the main
  engineering risk of Phase 1 — it is a split, not a rename — and it is
  pinned by the existing `changeTrackerLoadGuard.spec.ts` browser test plus
  new bus-gating tests (a switch fires each phase exactly once; an undo
  fires none).
- Emit `Close` from every death path: both branches of `closeWorkflow`
  (including temporary-workflow deletion, which never calls `unload()`
  today) and the `syncWorkflows` background-unload (as a forced close; a
  fresh `Open` follows on next activation). Forced-close ordering is:
  dispatch `Close`, release core document data and clear the ephemeral uid,
  then dispatch `PostClose` with the closing uid carried on the event so
  sidecars can clean up their last bucket before evicting it. No death path
  may complete with a live uid.
- Stamp websocket ingress with the resolved uid via the existing
  `jobIdToWorkflow` maps (D2).
- Migrate `widgetValueStore` / `previewExposureStore` onto the key helper
  **without changing when they rebuild**. Their state is graph-derived:
  today it is purged via `LGraph.clear()` on every `configure()` — which
  runs on undo/redo and revert as well as on tab switches — and naive
  uid-keyed survival would shadow reverted widget values after an undo
  (`registerWidget` returns a surviving entry unchanged when types match).
  Re-keying changes _who owns_ a bucket and moves eviction to `Close`;
  rebuild stays coupled to graph-state application, which becomes an
  explicit system trigger instead of a `clear()` side effect. Survival
  across tab switches then arrives automatically in Phase 5, when
  `configure()` stops running on switches — no further change to these
  stores needed.

### Phase 2 — migrate the hand-rolled implementations

Move the preview stash (PR #15360) and error scoping (PR #15361) onto uid
keys and lifecycle eviction, deleting their improvised close paths. Register
the compositor cache as the first sidecar (replacing its registry seat).
Switch the node-progress read path from the global `nodeProgressStates` to
the job-keyed record resolved through D2, fixing cross-tab progress
misattribution — the bug no snapshot scheme can reach. Implement the D1
orphan sweep (prune uid-keyed buckets whose uid has no live document)
alongside the first migrated consumers, so the degrade-to-leak argument is
backed by a mechanism rather than a promise.

### Phase 3 — `nodeOutputStore`

Key outputs/previews internally by `${uid}:${locator}` while keeping
`app.nodeOutputs` as a compat facade over the active document's bucket
(bare-id key format unchanged for packs). Rehome the `executed` listener
that currently writes into inactive `ChangeTracker`s. Split data from
resources: the document holds output locators/URLs; the blob-URL-owning
stash is a sidecar releasing at `PostClose`.

### Phase 4 — the document container (soon)

Introduce `ComfyWorkflowDocument` as the composition root: the uid, the file
handle (`ComfyWorkflow`), and the uid-keyed buckets absorbed as fields.
`ChangeTracker` is divided per D4's data/system separation: its _records_
(undo/redo queues, baselines) fold into the document; its _engine_ becomes
a single undo system operating on the current document; its snapshot
choreography shrinks. Legacy globals become read-through facades over the
active document (the deprecated delegating members on `ComfyApp` in
`src/scripts/app.ts` are the template; `window.graph` becomes a defined
property). Pinia stores flip to the facade pattern of D4. Extension hooks gain
an appended context argument identifying the document (non-breaking; the v2
node API takes the document handle natively).

### Phase 5 — the document store (later, own TDD)

Each open document owns a live `LGraph`; switching becomes
`canvas.setGraph(doc.graph)` — the same pointer-swap mechanism subgraph
navigation uses today, which the custom-node ecosystem already survives on
every subgraph enter/exit. `LGraph.clear()` stops firing on tab switch, so
graph ids stop being recycled and every graph-keyed store becomes correct by
construction. Snapshot/restore retires to what it is good at: persistence
(drafts, crash recovery) and a hydration/LRU memory policy (N most recent
documents live; older tabs dehydrated to JSON). The hydration policy and
`PostClose` resource disposal are designed as first-class per-type
contracts, not workflow conveniences: should heavier document types arrive
(a layered image document dwarfs a graph in memory), "live vs. dehydrated"
plus "what must be released on close" is what keeps a multi-document app
from becoming a browser-tab memory crisis. Prerequisite before landing:
extend the registry census matrix to drive the `setup`/`init`/
`beforeConfigureGraph`/`afterConfigureGraph` hooks, because reference
capture in those hooks is the one failure mode a facade cannot fix and the
matrix currently cannot see.

### Non-goals

Changing the ecosystem-visible key format of `app.nodeOutputs`; splitting
`ChangeTracker` as an end in itself; blocking on, or restarting, the ECS
rewrite; multi-view (split editors) and non-workflow document types — the
model permits both later (the manager, uid, and lifecycle are
type-agnostic) but nothing here builds them.

## Consequences

### Positive

- New per-document features (today, per-workflow) are correct by default:
  state filed under a uid with a defined death, instead of a global
  clobbered by the next switch.
  The fifth such feature costs one `registerDocumentSidecar()` call instead
  of edits to `workflowService` (there are currently four hand-rolled
  variants of this pattern, two written in the same week).
- The recurring bug class (state lost on switch, state leaking across tabs,
  results delivered to the wrong tab, resources never released) is closed by
  construction rather than by per-feature patches.
- Eviction failures degrade to sweepable leaks instead of resurrected state
  (D1); ordering failures become design-review findings instead of runtime
  races (D5).
- The guards-against-ourselves scaffolding (`isLoadingGraph`,
  `isActiveTracker`, `isWorkflowSwitching`) becomes progressively
  unnecessary rather than progressively better defended.
- Aligns the near-term codebase with the ECS target ("one source of truth
  per workflow instance") and gives the v2 node API its native handle,
  without coupling to either effort's schedule.
- Because documents are typed and the shared machinery is type-agnostic,
  the tab
  system generalizes for free: a future non-graph document type (blueprint,
  media session, …) gets identity, lifecycle, eviction, and sidecar support
  by declaring a type — not by rebuilding the machinery.

### Negative

- A transition period with two idioms in the tree; the lifecycle bus is one
  more concept to learn (mitigated: it _names_ a thing developers already
  navigate implicitly, and deletes flags/guards as it lands).
- Facade discipline is permanent: the legacy surface must keep resolving to
  the active document for as long as the v1 extension API lives.
- Phase 5 carries real, currently-unmeasured ecosystem risk (custom nodes
  capturing graph references in undriven hooks) and a memory cost for N live
  graphs — which is why it is gated behind census-matrix coverage and an
  explicit hydration policy, in its own TDD.
- Until Phase 5, uid-keyed survival of _graph-derived_ state still coexists
  with graph rebuild on switch; node object identity still does not survive
  a tab switch.

## Notes

- Original source: `origin/adr/frontend-document-model` @ `8606edcbb7`
  (the original numbered frontend-document-model path), authored by Ben Cooley.
- Ported to ADR-GRAPH-DOCUMENT-0026 on `main` @ `f954e479a3` (2026-08-31) after the original
  sequence 0018 was occupied by node-id reminting.
- Anticipated follow-up ADR: a generic document-behavior interface — basic
  editing behaviors such as undo/redo, cut/copy/paste/delete, possibly
  selection — that commands invoke on the active document, with each
  document type determining how the behavior is carried out. Deliberately
  not part of this spec; it builds on D4's mutator discipline and becomes
  practical once the Phase 4 container exists.
- Companion documents: TDD "Per-workflow transient state — scoping vs
  snapshot/restore" (Notion, 2026-08-17), whose Phases 0–4 correspond to
  Phases 0–3 here with the key and eviction mechanism amended per D1/D3;
  PR #14941 (`workflowTransientState` registry); PRs #15360, #15361, #15412
  (the hand-rolled scoping fixes this ADR generalizes); issue #3377,
  frontend PR #11951, and backend PR comfyanonymous/ComfyUI#13643
  (job→workflow attribution, the D2 rule's strong form);
  ADR-ECS-0008 and `docs/architecture/ecs-target-architecture.md` (the scoping
  direction this ADR supplies the foundation for).
- Prior art informing D3/D5: VS Code editor lifecycle
  (`onWillDispose`, `onWillSaveTextDocument`/`onDidSave`, memento LRU with
  opt-in retention), webpack tapable / Vite plugin pipelines
  (single-registration ordered hooks), browser `beforeunload` (pre-phase
  veto). The survey discriminator from the companion TDD — live handles,
  always-loaded contributors, one key, core-owned per-tab object — points at
  a document container rather than a serializer registry, and this ADR is
  that conclusion made explicit.

## Glossary

- **Document** — one live editing session for one piece of user content. It is
  separate from the file on disk and from the view that renders it.
- **Workflow document** — the first document type covered by this ADR; it owns
  workflow session data such as graph content, undo/redo records, execution
  state, warnings, view state, and dirty state.
- **`GraphDocument`** — the agent-facing workflow document shape specified by
  [ADR-GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md). It specializes this
  ADR's broader document model for target routing and offscreen application.
- **Document uid** — an in-memory session identifier minted when a document
  opens and erased when it closes. It is not persisted into workflow JSON.
- **Document manager** — the component that owns the open-document list, active
  pointer, and lifecycle transitions.
- **Lifecycle bus** — the centrally-owned event sequence (`Open`, `Activate`,
  `Deactivate`, `Close`, and related phases) that lets sidecars allocate and
  release per-document state without relying on tab-switch side effects.
- **Sidecar** — an external module with state keyed by document uid, such as a
  preview cache, compositor cache, thumbnail cache, or draft persistence helper.
- **Facade** — a compatibility surface, such as `app.graph`, that continues to
  look global to extensions while resolving through the active document.
- **ECS** — Entity Component System, the store-oriented frontend architecture
  described in [ADR-ECS-0008](ECS-0008-entity-component-system.md).
- **CRDT follower** — the frontend path governed by
  [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md) that applies
  host-produced document updates without becoming the merge authority.
