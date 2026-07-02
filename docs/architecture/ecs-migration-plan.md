# ECS Migration Plan

A phased roadmap for migrating the litegraph entity system to the ECS
architecture described in [ADR 0008](../adr/0008-entity-component-system.md).
Each phase is independently shippable. Later phases depend on earlier ones
unless noted otherwise.

For the problem analysis, see [Entity Problems](entity-problems.md). For the
target architecture, see [ECS Target Architecture](ecs-target-architecture.md).
For verified accuracy of these documents, see
[Appendix: Critical Analysis](appendix-critical-analysis.md).

> **Target end-state (revised):** N dedicated Pinia stores keyed by composite
> string IDs, one store per concern (widget values, DOM widgets, layout, node
> outputs, subgraph navigation, preview exposure). The earlier "single unified
> World with branded numeric entity IDs and `getComponent`/`setComponent`" model
> was rejected. PR 12617 shipped the first stores against composite
> `graphId:nodeId:name` string keys (`WidgetId`). Phases below are reframed
> around dedicated stores; shipped work is marked ✅.

## Planning assumptions

- The bridge period is expected to span 2-3 release cycles.
- Bridge work is treated as transitional debt with explicit owners and sunset
  checkpoints, not as a permanent architecture layer.
- Phase 5 is entered only by explicit go/no-go review against the criteria in
  this document.

## Phase 0: Foundation

Zero behavioral risk. Prepares the codebase for extraction without changing
runtime semantics. All items are independently shippable.

### 0a. Centralize version counter ✅ Shipped

`LGraph.incrementVersion()` exists and is used everywhere. The counter is only
read for debug display in `LGraphCanvas.renderInfo()`; it is not used for
dirty-checking, caching, or reactivity.

**Remaining cleanup:** One stray direct `_version++` at `LGraph.ts:831` should
be replaced with `incrementVersion()`.

**Risk:** None. Mechanical one-line change; existing null guards preserved.

### 0b. Add missing ID type aliases

`NodeId`, `LinkId`, and `RerouteId` exist as type aliases. Two are missing:

| Type        | Definition | Location                                                         |
| ----------- | ---------- | ---------------------------------------------------------------- |
| `GroupId`   | `number`   | `LGraphGroup.ts` (currently implicit on `id: number` at line 39) |
| `SlotIndex` | `number`   | `interfaces.ts` (slot positions are untyped `number` everywhere) |

**Change:** Add the type aliases, update property declarations, re-export from
barrel (`litegraph.ts`).

**Why:** Foundation for branded IDs. Type aliases are erased at compile time —
zero runtime impact.

**Risk:** None. Type-only change.

### 0c. Fix architecture doc errors

Five factual errors verified during code review (see
[Appendix](appendix-critical-analysis.md#vii-summary-of-findings)):

- `entity-problems.md`: `toJSON()` should be `toString()`, `execute()` should
  be `doExecute()`, method count ~539 should be ~848, `configure()` is ~240
  lines not ~180

---

## Phase 1: Types and Dedicated Stores

Introduces the ID type vocabulary and the dedicated stores. Phase 1 end-state is
N dedicated Pinia stores, each keyed by a composite string ID, coexisting with
legacy class instances.

### 1a. Branded string ID types ✅ Shipped (PR 12617)

`src/types/widgetId.ts` ships the branded string `WidgetId`:

```ts
type WidgetId = string & { readonly __brand: 'WidgetId' }
```

Format: `graphId:nodeId:name`. A `parseWidgetId()` helper splits a `WidgetId`
back into its `{ graphId, nodeId, name }` parts at store boundaries.

The composite string key carries the structural relationship (graph -> node ->
widget) directly in the key. There is no synthetic opaque number and no reverse
lookup index.

**Consideration:** `NodeId = number | string`. The `string` branch exists for
subgraph-related nodes (GroupNode hack). The `WidgetId` format stringifies the
`nodeId` segment, so both numeric and string node IDs flow through unchanged.

### 1b. Plain-data store state shapes

Each dedicated store holds plain-data records for its concern — no methods on the
records, behavior lives in store actions and composables. State shapes mirror the
decomposition in ADR 0008 Section "Component Decomposition" (position, node type,
node visual, connectivity, execution, properties, widget container, link
endpoints).

**Risk:** None. Type-only definitions.

### 1c. Dedicated stores

Phase 1 end-state is a set of dedicated Pinia stores, one per concern, each
keyed by its own composite string ID. Each store owns its data and exposes a
narrow accessor surface. There is no single container that fronts all entities.

Shipped stores:

| Store                     | File                                            |
| ------------------------- | ----------------------------------------------- |
| `widgetValueStore`        | `src/stores/widgetValueStore.ts`                |
| `domWidgetStore`          | `src/stores/domWidgetStore.ts`                  |
| `layoutStore`             | `src/renderer/core/layout/store/layoutStore.ts` |
| `nodeOutputStore`         | `src/stores/nodeOutputStore.ts`                 |
| `subgraphNavigationStore` | `src/stores/subgraphNavigationStore.ts`         |
| `previewExposureStore`    | `src/stores/previewExposureStore.ts`            |

`widgetValueStore` exposes `registerWidget`, `getWidget`, `setValue`,
`deleteWidget`, `getNodeWidgets`, and `clearGraph`, all `WidgetId`-native. There
is no shared `lastWidgetId` counter; identity comes from the composite key.

Store scope is per workflow instance. Linked subgraph definitions can be reused
across instances, but mutable runtime state (widget values, execution state,
selection/transient view state) stays instance-scoped through `graphId` embedded
in each composite key.

Subgraphs are not a separate store. Subgraph nesting is tracked in
`subgraphNavigationStore`. See
[Subgraph Boundaries](subgraph-boundaries-and-promotion.md) for the full model.

**Risk:** Low. Stores are additive; integration happens in Phase 2.

---

## Phase 2: Store Integration

Connects the legacy class instances to the dedicated stores. Both old and new
code can read entity state; writes for not-yet-migrated concerns still go through
legacy classes.

### 2a. Position reads through layoutStore

`layoutStore` (`src/renderer/core/layout/store/layoutStore.ts`) already extracts
position data for nodes, links, and reroutes into Y.js CRDTs and is the source of
truth for layout.

**Approach:** New code reads position via `layoutStore` queries (and
`useLayoutMutations()` for writes); legacy code continues to read `node.pos`
directly during the transition. No second copy of position data is introduced —
`layoutStore` stays authoritative.

**Risk:** Medium. The legacy `node.pos` read path must stay consistent with
`layoutStore` during the transition. Watch for stale reads during render.

### 2b. Consolidate widget callers onto widgetValueStore ✅ Largely shipped (PR 12617)

`widgetValueStore` (`src/stores/widgetValueStore.ts`) holds widget state in
plain records keyed by `WidgetId` (`graphId:nodeId:name`) and is the source of
truth for widget values. PR 12617 reverted the earlier synthetic-numeric-ID
bridge approach.

**Remaining work:** Consolidate the remaining widget callers onto
`widgetValueStore`. Reads use `getWidget(widgetId)` / `getNodeWidgets(graphId,
nodeId)`; writes use `setValue(widgetId, value)`; `parseWidgetId()` recovers the
`{ graphId, nodeId, name }` parts at boundaries.

**Risk:** Low. The store is well-structured and `WidgetId`-native; identity comes
from the composite key with no separate lookup index.

**Promoted-widget caveat:** ADR 0009 assigns promoted value widgets a
host-boundary identity (`host node locator + SubgraphInput.name`). Interior
source node/widget identity is preserved only as migration and diagnostic
metadata.

### 2c. Node metadata stores

Populate node-metadata records (node type, visual, properties, execution) by
reading from `LGraphNode` instances. These are simple property copies into the
relevant store.

**Approach:** When a node is added to the graph (`LGraph.add()`), the store
records its metadata. When a node is removed, the store drops it. The
`incrementVersion()` seam from Phase 0a is a candidate hook point for re-sync
when changed.

**Risk:** Medium. Must handle the full node lifecycle (add, configure, remove)
without breaking existing behavior. Stores mirror the classes during the
transition, which limits blast radius.

### Store sunset criteria (applies to every Phase 2 concern)

A legacy path can move from "transitional" to "removal candidate" only when:

- All production reads for that concern flow through store accessors.
- All production writes for that concern flow through store actions.
- Serialization parity tests show no diff between legacy and store-driven paths.
- Extension compatibility tests pass without legacy-only fallback paths.

These criteria prevent the dual path from becoming permanent by default.

### Dual-path duration and maintenance controls

To contain dual-path maintenance cost during Phases 2-4:

- Every concern has a named owner and target sunset release.
- Every PR touching store-covered data paths must include parity tests for both
  legacy and store-driven execution.
- Legacy fallback usage is instrumented in integration/e2e and reviewed every
  milestone; upward trends block new dual-path expansion.
- Any concern that misses its target sunset release requires an explicit risk
  review and revised removal plan.

---

## Phase 3: Systems

Introduce system functions that operate on store data. Systems coexist with
legacy methods — they don't replace them yet.

### 3a. SerializationSystem (read-only)

A function `serializeFromStores(): SerializedGraph` that produces workflow JSON
by querying the dedicated stores. Run alongside the existing `LGraph.serialize()`
in tests to verify equivalence.

**Why first:** Serialization is read-only and has a clear correctness check
(output must match existing serialization). It exercises every store and proves
the stores contain sufficient data.

**Risk:** Low. Runs in parallel with existing code; does not replace it.

### 3b. VersionSystem

Move change tracking behind a system that observes store mutations and
auto-increments the version counter, replacing scattered explicit increment
calls.

**Dependency:** Requires Phase 2 store integration (otherwise the system doesn't
see changes).

**Risk:** Medium. Must not miss any change that the scattered `_version++`
historically caught.

### 3c. ConnectivitySystem (queries only)

A system that answers connectivity queries by reading connectivity, slot, and
link-endpoint records from the relevant stores:

- "What nodes are connected to this node's inputs?"
- "What links pass through this reroute?"
- "What is the execution order?"

Does not perform mutations yet — just queries. Validates that store connectivity
data is complete and consistent with the class-based graph.

**Risk:** Low. Read-only system with equivalence tests.

---

## Phase 4: Write Path Migration

Systems begin owning mutations. Legacy class methods delegate to stores and
systems. This is the highest-risk phase.

### 4a. Position writes through layoutStore

New code writes position via `useLayoutMutations()` against `layoutStore`. A
compatibility shim propagates changes back to `LGraphNode.pos` for legacy
readers.

**This inverts the data flow:** Phase 2 had legacy -> store (read path). Phase 4
has store -> legacy (write path). Both must work during the transition.

**Risk:** High. Two-way sync between `layoutStore` and legacy state. Must handle
re-entrant updates (store write triggers the shim, which writes to legacy, which
must NOT trigger another store write).

### 4b. ConnectivitySystem mutations

`connect()`, `disconnect()`, `removeNode()` operations implemented as system
functions over the connectivity stores. Legacy `LGraphNode.connect()` etc.
delegate to the system.

**Extension API concern:** The current system fires callbacks at each step:

- `onConnectInput()` / `onConnectOutput()` — can reject connections
- `onConnectionsChange()` — notifies after connection change
- `onRemoved()` — notifies after node removal

These callbacks are the **extension API contract**. The ConnectivitySystem
must fire them at the same points in the operation, or extensions break.

**Recommended approach:** The system emits lifecycle events that the bridge
layer translates into legacy callbacks. This preserves the contract without
the system knowing about the callback API.

**Phase 4 callback contract (locked):**

- `onConnectOutput()` and `onConnectInput()` run before any store mutation.
- If either callback rejects, abort with no store writes, no version bump,
  and no lifecycle events.
- `onConnectionsChange()` fires synchronously after commit, preserving current
  source-then-target ordering.
- Bridge lifecycle events remain internal. Legacy callbacks stay the public
  compatibility API during Phase 4.

**Risk:** High. Extensions depend on callback ordering and timing. Must be
validated against real-world extensions.

### 4c. Widget write path ✅ Largely shipped (PR 12617)

`widgetValueStore.setValue()` is already the widget write path and the source of
truth for widget values. Remaining work routes the last legacy widget writers
through `setValue()` rather than mutating widget instances directly.

**Risk:** Medium. The store is well-abstracted and `WidgetId`-native. The main
change is migrating the remaining direct-mutation call sites onto `setValue()`.

### 4d. Layout write path and render decoupling

Remove layout side effects from render incrementally by node family.

**Approach:**

1. Inventory `drawNode()` call paths that still trigger `arrange()`.
2. For one node family at a time, run `LayoutSystem` in update phase and mark
   entities as layout-clean before render.
3. Keep a temporary compatibility fallback that runs legacy layout only for
   non-migrated families.
4. Delete fallback once parity tests and frame-time budgets are met.

**Risk:** High. Mixed-mode operation must avoid stale layout reads. Requires
family-level rollout and targeted regression tests.

### Render hot-path performance gate

Before enabling ECS render reads as default for any migrated family:

- Benchmark representative workflows (200-node and 500-node minimum).
- Compare legacy vs ECS p95 frame time and mean draw cost.
- Block rollout on statistically significant regression beyond agreed budget
  (default budget: 5% p95 frame-time regression ceiling).
- Capture profiler traces proving the dominant cost is not repeated store
  accessor lookups.

### Phase 3 -> 4 gate (required)

Phase 4 starts only when all of the following are true:

- A store/command-executor transaction wrapper exists and is used by connectivity
  and widget write paths in integration tests.
- Undo batching parity is proven: one logical user action yields one undo
  checkpoint in both legacy and store-driven paths.
- Callback timing and rejection semantics from Phase 4b are covered by
  integration tests.
- A representative extension suite passes, including `rgthree-comfy`.
- Write-path re-entrancy tests prove there is no store <-> legacy feedback
  loop.
- Layout migration for any enabled node family passes read-only render checks
  (no `arrange()` writes during draw).
- Render hot-path benchmark gate passes for every family moving to store-first
  reads.

---

## Phase 5: Legacy Removal

Remove bridge layers and deprecated class properties. This phase happens
per-component, not all at once.

### 5a. Remove Position compatibility shim

Once all position reads and writes go through `layoutStore`, remove the
compatibility shim and the `pos`/`size` properties from `LGraphNode`, `Reroute`,
`LGraphGroup`.

### 5b. Remove widget class hierarchy

Once all widget behavior is in systems, the 23+ widget subclasses can be
replaced with component data + system functions. `BaseWidget`, `NumberWidget`,
`ComboWidget`, etc. become configuration data rather than class instances.

### 5c. Dissolve god objects

`LGraphNode`, `LLink`, `LGraph` become thin shells — their only role is holding
the composite ID and delegating to the stores. Eventually, they can be removed
entirely, replaced by composite IDs + store queries.

**Risk:** Very High. This is the irreversible step. Must be done only after
thorough validation that all consumers (including extensions) work with the
ECS path.

### Phase 4 -> 5 exit criteria (required)

Legacy removal starts only when all of the following are true:

- The concern being removed has no remaining direct reads or writes outside
  store/system APIs.
- Serialization equivalence tests pass continuously for one release cycle.
- A representative extension compatibility matrix is green, including
  `rgthree-comfy`.
- Bridge instrumentation shows zero fallback-path usage in integration and e2e
  suites.
- A rollback plan exists for each removal PR until the release is cut.
- ECS write path has run as default behind a kill switch for at least one full
  release cycle.
- No unresolved P0/P1 extension regressions are attributed to ECS migration in
  that cycle.

### Phase 5 trigger packet (required before first legacy-removal PR)

The team prepares a single go/no-go packet containing:

- Phase 4 -> 5 criteria checklist with links to evidence.
- Extension compatibility matrix results.
- Bridge fallback usage report (must be zero for the target concern).
- Performance gate report for ECS render/read paths.
- Rollback owner, rollback steps, and release coordination sign-off.

---

## Open Questions

### CRDT / ECS coexistence

`layoutStore` uses Y.js CRDTs for collaboration-ready position data
(per [ADR 0003](../adr/0003-crdt-based-layout-system.md)). The other dedicated
stores hold plain reactive data. These must coexist.

`layoutStore` stays authoritative for layout (Phase 2a), so position data has a
single CRDT-backed home. Whether other stores need CRDT backing is open and
requires a separate ADR.

**Questions to resolve:**

- Should non-position stores also be CRDT-backed for collaboration?
- Do the stores need an operation log for undo/redo, or can that remain external
  (Y.js undo manager)?
- How does conflict resolution work when two users modify the same record?

### Extension API preservation

The current system exposes lifecycle callbacks on entity classes:

| Callback              | Class        | Purpose                             |
| --------------------- | ------------ | ----------------------------------- |
| `onConnectInput`      | `LGraphNode` | Validate/reject incoming connection |
| `onConnectOutput`     | `LGraphNode` | Validate/reject outgoing connection |
| `onConnectionsChange` | `LGraphNode` | React to topology change            |
| `onRemoved`           | `LGraphNode` | Cleanup on deletion                 |
| `onAdded`             | `LGraphNode` | Setup on graph insertion            |
| `onConfigure`         | `LGraphNode` | Post-deserialization hook           |
| `onWidgetChanged`     | `LGraphNode` | React to widget value change        |

Extensions register these callbacks to customize node behavior. The ECS
migration must preserve this contract or provide a documented migration path
for extension authors.

**Recommended approach:** Define an `EntityLifecycleEvent` system that emits
typed events at the same points where callbacks currently fire. The bridge
layer translates events into legacy callbacks. Extensions can gradually adopt
event listeners instead of callbacks.

**Phase 4 decisions:**

- Rejection callbacks act as pre-commit guards (reject before store mutation).
- Callback dispatch remains synchronous during the bridge period.
- Callback order remains: output validation -> input validation -> commit ->
  output change notification -> input change notification.

### Extension Migration Examples (old -> new)

The bridge keeps legacy callbacks working, but extension authors can migrate
incrementally to ECS-native patterns.

#### 1) Widget lookup by name

```ts
// Legacy pattern
const seedWidget = node.widgets?.find((w) => w.name === 'seed')
seedWidget?.setValue(42)

// Store pattern (composite WidgetId, no reverse-lookup index needed)
const seedWidgetId = widgetValueStore
  .getNodeWidgets(graphId, nodeId)
  .find((id) => parseWidgetId(id).name === 'seed')
if (seedWidgetId) {
  widgetValueStore.setValue(seedWidgetId, 42)
}
```

#### 2) `onConnectionsChange` callback

```ts
// Legacy pattern
nodeType.prototype.onConnectionsChange = function (
  side,
  slot,
  connected,
  linkInfo
) {
  updateExtensionState(this.id, side, slot, connected, linkInfo)
}

// ECS pattern
lifecycleEvents.on('connection.changed', (event) => {
  if (event.nodeId !== nodeId) return
  updateExtensionState(
    event.nodeId,
    event.side,
    event.slotIndex,
    event.connected,
    event.linkInfo
  )
})
```

#### 3) `onRemoved` callback

```ts
// Legacy pattern
nodeType.prototype.onRemoved = function () {
  cleanupExtensionResources(this.id)
}

// ECS pattern
lifecycleEvents.on('entity.removed', (event) => {
  if (event.kind !== 'node' || event.entityId !== nodeId) return
  cleanupExtensionResources(event.entityId)
})
```

#### 4) `graph._version++`

```ts
// Legacy pattern (do not add new usages)
graph._version++

// Transitional pattern (Phase 0a)
graph.incrementVersion()

// Store-native pattern: mutate through the command/system API.
// VersionSystem bumps once at transaction commit.
executor.run({
  type: 'SetWidgetValue',
  execute() {
    widgetValueStore.setValue(widgetId, 42)
  }
})
```

**Question to resolve after compatibility parity:**

- Should ECS-native lifecycle events stay synchronous after bridge removal, or
  can they become asynchronous once legacy callback compatibility is dropped?

### Atomicity and transactions

The lifecycle scenarios claim operations are "atomic." This requires a
store/command-executor transaction — the ability to batch multiple store writes
and commit or rollback as a unit. `layoutStore` already wraps its mutations in
Y.js transactions; the command executor extends the same discipline across
stores.

**Current state:** `beforeChange()` / `afterChange()` provide undo/redo
checkpoints but not true transactions. The graph can be in an inconsistent
state between these calls.

**Phase 4 baseline semantics:**

- Mutating systems run inside a single command-executor transaction.
- The bridge maps one executor transaction to one `beforeChange()` /
  `afterChange()` bracket.
- Operations with multiple store writes (for example `connect()` touching
  slots, links, and node metadata) still commit as one transaction and therefore
  one undo entry.
- Failed transactions do not publish partial writes, lifecycle events, or
  version increments.

**Questions to resolve:**

- How should the command-executor transaction interact with the Y.js
  transactions that `layoutStore` already runs?
- Is eventual consistency acceptable for derived data updates between
  transactions, or must post-transaction state always be immediately
  consistent?

### Keying strategy unification

The dedicated stores use per-concern keying strategies:

| Store                     | Key Format                         |
| ------------------------- | ---------------------------------- |
| `widgetValueStore`        | `WidgetId` (`graphId:nodeId:name`) |
| `domWidgetStore`          | Widget UUID                        |
| `layoutStore`             | Raw nodeId/linkId/rerouteId        |
| `nodeOutputStore`         | `"${subgraphId}:${nodeId}"`        |
| `subgraphNavigationStore` | subgraphId or `'root'`             |

ADR 0009 refines the promoted-widget target: promoted value widgets should use
host boundary identity (`host node locator + SubgraphInput.name`), not interior
source node/widget identity.

Composite string keys won over synthetic numeric IDs. A widget is identified by
its relationship to a graph and node, and the `graphId:nodeId:name` key carries
that relationship directly. PR 12617 kept the composite string instead of an
opaque number, so no reverse lookup index is required — `parseWidgetId()`
recovers the parts on demand.

**Resolution:** Self-documenting composite keys, parsed at boundaries. Each store
keeps the key format that matches its concern; there is no forced unification
under a single ID space.

---

## Dependency Graph

```
Phase 0a (incrementVersion)  ──── ✅ shipped (one stray cleanup remaining)
Phase 0b (ID type aliases)  ───┐
Phase 0c (doc fixes)  ─────────┤── no dependencies between these

Phase 1a (branded WidgetId)  ── ✅ shipped (PR 12617)
Phase 1b (store state shapes) ─┐── depends on 1a
Phase 1c (dedicated stores)  ──┘── widgetValueStore + 5 others shipped (PR 12617)

Phase 2a (Position via layoutStore) ─┐── depends on 1c
Phase 2b (Widget consolidation)  ────┤── ✅ largely shipped; depends on 1a, 1c
Phase 2c (Node metadata stores)  ────┘── depends on 1c

Phase 3a (SerializationSystem)  ─── depends on 2a, 2b, 2c
Phase 3b (VersionSystem)  ──────── depends on 2c (store-level change tracking)
Phase 3c (ConnectivitySystem)  ──── depends on 2c

Phase 3->4 gate checklist  ──────── depends on 3a, 3b, 3c

Phase 4a (Position writes)  ────── depends on 2a, 3b
Phase 4b (Connectivity mutations) ─ depends on 3c, 3->4 gate
Phase 4c (Widget writes)  ─────── ✅ largely shipped; depends on 2b
Phase 4d (Layout decoupling)  ─── depends on 2a, 3->4 gate

Phase 4->5 exit criteria  ──────── depends on all of Phase 4

Phase 5 (legacy removal)  ─────── depends on 4->5 exit criteria
```

The dedicated stores (1c) are the hub: Phase 2 routes legacy data into them,
Phase 3 systems read from them, Phase 4 routes writes through them.

## Risk Summary

| Phase                 | Risk       | Reversibility           | Extension Impact            |
| --------------------- | ---------- | ----------------------- | --------------------------- |
| 0 (Foundation)        | None       | Fully reversible        | None                        |
| 1 (Types/Stores)      | Low        | New files, deletable    | None                        |
| 2 (Store integration) | Low-Medium | Additive store reads    | None                        |
| 3 (Systems)           | Low-Medium | Systems run in parallel | None                        |
| 4 (Write path)        | High       | Two-way sync is fragile | Callbacks must be preserved |
| 5 (Legacy removal)    | Very High  | Irreversible            | Extensions must migrate     |

The plan is designed so that Phases 0-3 can ship without any risk to
extensions or existing behavior. Phase 4 is where the real migration begins,
and Phase 5 is the point of no return.
