# ECS Migration Plan

A phased roadmap for migrating the litegraph entity system to the ECS
architecture described in [ADR 0008](../adr/0008-entity-component-system.md).
Each phase is independently shippable. Later phases depend on earlier ones
unless noted otherwise.

For the problem analysis, see [Entity Problems](entity-problems.md). For the
target architecture, see [ECS Target Architecture](ecs-target-architecture.md).
For verified accuracy of these documents, see
[Appendix: Critical Analysis](appendix-critical-analysis.md).

## Phase 0: Foundation

Zero behavioral risk. Prepares the codebase for extraction without changing
runtime semantics. All items are independently shippable.

### 0a. Centralize version counter

`graph._version++` appears in 19 locations across 7 files. The counter is only
read once — for debug display in `LGraphCanvas.renderInfo()` (line 5389). It
is not used for dirty-checking, caching, or reactivity.

**Change:** Add `LGraph.incrementVersion()` and replace all 19 direct
increments.

```
incrementVersion(): void {
  this._version++
}
```

| File                   | Sites                                                   |
| ---------------------- | ------------------------------------------------------- |
| `LGraph.ts`            | 5 (lines 956, 989, 1042, 1109, 2643)                    |
| `LGraphNode.ts`        | 8 (lines 833, 2989, 3138, 3176, 3304, 3539, 3550, 3567) |
| `LGraphCanvas.ts`      | 2 (lines 3084, 7880)                                    |
| `BaseWidget.ts`        | 1 (line 439)                                            |
| `SubgraphInput.ts`     | 1 (line 137)                                            |
| `SubgraphInputNode.ts` | 1 (line 190)                                            |
| `SubgraphOutput.ts`    | 1 (line 102)                                            |

**Why first:** Creates the seam where a VersionSystem can later intercept,
batch, or replace the mechanism. Mechanical find-and-replace with zero
behavioral change.

**Risk:** None. Existing null guards at call sites are preserved.

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
- `proto-ecs-stores.md`: `resolveDeepest()` does not exist on
  PromotedWidgetViewManager; actual methods are `reconcile()` / `getOrCreate()`

---

## Phase 1: Types and World Shell

Introduces the ECS type vocabulary and an empty World. No migration of existing
code — new types coexist with old ones.

### 1a. Branded entity ID types

Define branded types in a new `src/ecs/entityId.ts`:

```
type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }
// ... etc per ADR 0008
```

Add cast helpers (`asNodeEntityId(id: number): NodeEntityId`) for use at
system boundaries (deserialization, legacy bridge).

**Does NOT change existing code.** The branded types are new exports consumed
only by new ECS code.

**Risk:** Low. New files, no modifications to existing code.

**Consideration:** `NodeId = number | string` is the current type. The branded
`NodeEntityId` narrows to `number`. The `string` branch exists solely for
subgraph-related nodes (GroupNode hack). The migration must decide whether to:

- Keep `NodeEntityId = number` and handle the string case at the bridge layer
- Or define `NodeEntityId = number | string` with branding (less safe)

Recommend the former: the bridge layer coerces string IDs to a numeric
mapping, and only branded numeric IDs enter the World.

### 1b. Component interfaces

Define component interfaces in `src/ecs/components/`:

```
src/ecs/
  entityId.ts          # Branded ID types
  components/
    position.ts        # Position (shared by Node, Reroute, Group)
    nodeType.ts        # NodeType
    nodeVisual.ts      # NodeVisual
    connectivity.ts    # Connectivity
    execution.ts       # Execution
    properties.ts      # Properties
    widgetContainer.ts # WidgetContainer
    linkEndpoints.ts   # LinkEndpoints
    ...
  world.ts             # World type and factory
```

Components are TypeScript interfaces only — no runtime code. They mirror
the decomposition in ADR 0008 Section "Component Decomposition."

**Risk:** None. Interface-only files.

### 1c. World type

Define the World as a typed container:

```ts
interface World {
  nodes: Map<NodeEntityId, NodeComponents>
  links: Map<LinkEntityId, LinkComponents>
  widgets: Map<WidgetEntityId, WidgetComponents>
  slots: Map<SlotEntityId, SlotComponents>
  reroutes: Map<RerouteEntityId, RerouteComponents>
  groups: Map<GroupEntityId, GroupComponents>
  subgraphs: Map<SubgraphEntityId, SubgraphComponents>

  createEntity<K extends EntityKind>(kind: K): EntityIdFor<K>
  deleteEntity<K extends EntityKind>(kind: K, id: EntityIdFor<K>): void
  getComponent<C>(id: EntityId, component: ComponentKey<C>): C | undefined
  setComponent<C>(id: EntityId, component: ComponentKey<C>, data: C): void
}
```

Initial implementation: plain `Map`-backed. No reactivity, no CRDT, no
persistence. The World exists but nothing populates it yet.

**Risk:** Low. New code, no integration points.

---

## Phase 2: Bridge Layer

Connects the legacy class instances to the World. Both old and new code can
read entity state; writes still go through legacy classes.

### 2a. Read-only bridge for Position

The LayoutStore (`src/renderer/core/layout/store/layoutStore.ts`) already
extracts position data for nodes, links, and reroutes into Y.js CRDTs. The
bridge reads from LayoutStore and populates the World's `Position` component.

**Approach:** A `PositionBridge` that observes LayoutStore changes and mirrors
them into the World. New code reads `world.getComponent(nodeId, Position)`;
legacy code continues to read `node.pos` / LayoutStore directly.

**Open question:** Should the World wrap the Y.js maps or maintain its own
plain-data copy? Options:

| Approach               | Pros                                  | Cons                                            |
| ---------------------- | ------------------------------------- | ----------------------------------------------- |
| World wraps Y.js       | Single source of truth; no sync lag   | World API becomes CRDT-aware; harder to test    |
| World copies from Y.js | Clean World API; easy to test         | Two copies of position data; sync overhead      |
| World replaces Y.js    | Pure ECS; no CRDT dependency in World | Breaks collaboration (ADR 0003); massive change |

**Recommendation:** Start with "World copies from Y.js" for simplicity. The
copy is cheap (position is small data). Revisit if sync overhead becomes
measurable.

**Risk:** Medium. Introduces a sync point between two state systems. Must
ensure the bridge doesn't create subtle ordering bugs (e.g., World reads stale
position during render).

### 2b. Read-only bridge for WidgetValue

WidgetValueStore (`src/stores/widgetValueStore.ts`) already extracts widget
state into plain `WidgetState` objects keyed by `graphId:nodeId:name`. This is
the closest proto-ECS store.

**Approach:** A `WidgetBridge` that maps `WidgetValueStore` entries into
`WidgetValue` components in the World, keyed by `WidgetEntityId`. Requires
assigning synthetic widget IDs (via `lastWidgetId` counter on LGraphState).

**Dependency:** Requires 1a (branded IDs) for `WidgetEntityId`.

**Risk:** Low-Medium. WidgetValueStore is well-structured. Main complexity is
the ID mapping — widgets currently lack independent IDs, so the bridge must
maintain a `(nodeId, widgetName) -> WidgetEntityId` lookup.

### 2c. Read-only bridge for Node metadata

Populate `NodeType`, `NodeVisual`, `Properties`, `Execution` components by
reading from `LGraphNode` instances. These are simple property copies.

**Approach:** When a node is added to the graph (`LGraph.add()`), the bridge
creates the corresponding entity in the World and populates its components.
When a node is removed, the bridge deletes the entity.

The `incrementVersion()` method from Phase 0a becomes the hook point — when
version increments, the bridge can re-sync changed components. (This is why
centralizing version first matters.)

**Risk:** Medium. Must handle the full node lifecycle (add, configure, remove)
without breaking existing behavior. The bridge is read-only (World mirrors
classes, not the reverse), which limits blast radius.

---

## Phase 3: Systems

Introduce system functions that operate on World data. Systems coexist with
legacy methods — they don't replace them yet.

### 3a. SerializationSystem (read-only)

A function `serializeFromWorld(world: World): SerializedGraph` that produces
workflow JSON by querying World components. Run alongside the existing
`LGraph.serialize()` in tests to verify equivalence.

**Why first:** Serialization is read-only and has a clear correctness check
(output must match existing serialization). It exercises every component type
and proves the World contains sufficient data.

**Risk:** Low. Runs in parallel with existing code; does not replace it.

### 3b. VersionSystem

Replace the `incrementVersion()` method with a system that owns all change
tracking. The system observes component mutations on the World and
auto-increments the version counter.

**Dependency:** Requires Phase 2 bridges to be in place (otherwise the World
doesn't see changes).

**Risk:** Medium. Must not miss any change that the scattered `_version++`
currently catches. The 19-site inventory from Phase 0a serves as the test
matrix.

### 3c. ConnectivitySystem (queries only)

A system that can answer connectivity queries by reading `Connectivity`,
`SlotConnection`, and `LinkEndpoints` components from the World:

- "What nodes are connected to this node's inputs?"
- "What links pass through this reroute?"
- "What is the execution order?"

Does not perform mutations yet — just queries. Validates that the World's
connectivity data is complete and consistent with the class-based graph.

**Risk:** Low. Read-only system with equivalence tests.

---

## Phase 4: Write Path Migration

Systems begin owning mutations. Legacy class methods delegate to systems.
This is the highest-risk phase.

### 4a. Position writes through World

New code writes position via `world.setComponent(nodeId, Position, ...)`.
The bridge propagates changes back to LayoutStore and `LGraphNode.pos`.

**This inverts the data flow:** Phase 2 had legacy -> World (read bridge).
Phase 4 has World -> legacy (write bridge). Both paths must work during the
transition.

**Risk:** High. Two-way sync between World and legacy state. Must handle
re-entrant updates (World write triggers bridge, which writes to legacy,
which must NOT trigger another World write).

### 4b. ConnectivitySystem mutations

`connect()`, `disconnect()`, `removeNode()` operations implemented as system
functions on the World. Legacy `LGraphNode.connect()` etc. delegate to the
system.

**Extension API concern:** The current system fires callbacks at each step:

- `onConnectInput()` / `onConnectOutput()` — can reject connections
- `onConnectionsChange()` — notifies after connection change
- `onRemoved()` — notifies after node removal

These callbacks are the **extension API contract**. The ConnectivitySystem
must fire them at the same points in the operation, or extensions break.

**Recommended approach:** The system emits lifecycle events that the bridge
layer translates into legacy callbacks. This preserves the contract without
the system knowing about the callback API.

**Risk:** High. Extensions depend on callback ordering and timing. Must be
validated against real-world extensions.

### 4c. Widget write path

Widget value changes go through the World instead of directly through
WidgetValueStore. The World's `WidgetValue` component becomes the single
source of truth; WidgetValueStore becomes a read-through cache or is removed.

**Risk:** Medium. WidgetValueStore is already well-abstracted. The main
change is routing writes through the World instead of the store.

---

## Phase 5: Legacy Removal

Remove bridge layers and deprecated class properties. This phase happens
per-component, not all at once.

### 5a. Remove Position bridge

Once all position reads and writes go through the World, remove the bridge
and the `pos`/`size` properties from `LGraphNode`, `Reroute`, `LGraphGroup`.

### 5b. Remove widget class hierarchy

Once all widget behavior is in systems, the 23+ widget subclasses can be
replaced with component data + system functions. `BaseWidget`, `NumberWidget`,
`ComboWidget`, etc. become configuration data rather than class instances.

### 5c. Dissolve god objects

`LGraphNode`, `LLink`, `LGraph` become thin shells — their only role is
holding the entity ID and delegating to the World. Eventually, they can be
removed entirely, replaced by entity ID + component queries.

**Risk:** Very High. This is the irreversible step. Must be done only after
thorough validation that all consumers (including extensions) work with the
ECS path.

---

## Open Questions

### CRDT / ECS coexistence

The LayoutStore uses Y.js CRDTs for collaboration-ready position data
(per [ADR 0003](../adr/0003-crdt-based-layout-system.md)). The ECS World
uses plain `Map`s. These must coexist.

**Options explored in Phase 2a.** The recommended path (World copies from Y.js)
defers the hard question. Eventually, the World may need to be CRDT-native —
but this requires a separate ADR.

**Questions to resolve:**

- Should non-position components also be CRDT-backed for collaboration?
- Does the World need an operation log for undo/redo, or can that remain
  external (Y.js undo manager)?
- How does conflict resolution work when two users modify the same component?

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

**Questions to resolve:**

- Can extension callbacks that reject operations (e.g., `onConnectInput`
  returning `false`) work with a system that has already committed the
  connection to the World?
- Should the event system be synchronous (preserving current behavior) or
  asynchronous (enabling batching)?

### Atomicity and transactions

The ECS lifecycle scenarios claim operations are "atomic." This requires
the World to support transactions — the ability to batch multiple component
writes and commit or rollback as a unit.

**Current state:** `beforeChange()` / `afterChange()` provide undo/redo
checkpoints but not true transactions. The graph can be in an inconsistent
state between these calls.

**Questions to resolve:**

- Does the World need a `transaction()` API?
- How does this interact with Y.js transactions (which already batch CRDT
  operations)?
- Is eventual consistency acceptable (systems correct inconsistencies on next
  tick), or must every operation be immediately consistent?

### Keying strategy unification

The 6 proto-ECS stores use 6 different keying strategies:

| Store                   | Key Format                        |
| ----------------------- | --------------------------------- |
| WidgetValueStore        | `"${nodeId}:${widgetName}"`       |
| PromotionStore          | `"${sourceNodeId}:${widgetName}"` |
| DomWidgetStore          | Widget UUID                       |
| LayoutStore             | Raw nodeId/linkId/rerouteId       |
| NodeOutputStore         | `"${subgraphId}:${nodeId}"`       |
| SubgraphNavigationStore | subgraphId or `'root'`            |

The World unifies these under branded entity IDs. But stores that use
composite keys (e.g., `nodeId:widgetName`) reflect a genuine structural
reality — a widget is identified by its relationship to a node. Synthetic
`WidgetEntityId`s replace this with an opaque number, requiring a reverse
lookup index.

**Trade-off:** Type safety and uniformity vs. self-documenting keys. The
World should maintain a lookup index (`(nodeId, widgetName) -> WidgetEntityId`)
for the transition period.

---

## Dependency Graph

```
Phase 0a (incrementVersion)  ──┐
Phase 0b (ID type aliases)  ───┤
Phase 0c (doc fixes)  ─────────┤── no dependencies between these
                                │
Phase 1a (branded IDs)  ────────┤
Phase 1b (component interfaces) ┤── 1b depends on 1a
Phase 1c (World type)  ─────────┘── 1c depends on 1a, 1b

Phase 2a (Position bridge)  ────┐── depends on 1c
Phase 2b (Widget bridge)  ──────┤── depends on 1a, 1c
Phase 2c (Node metadata bridge) ┘── depends on 0a, 1c

Phase 3a (SerializationSystem)  ─── depends on 2a, 2b, 2c
Phase 3b (VersionSystem)  ──────── depends on 0a, 2c
Phase 3c (ConnectivitySystem)  ──── depends on 2c

Phase 4a (Position writes)  ────── depends on 2a, 3b
Phase 4b (Connectivity mutations) ─ depends on 3c
Phase 4c (Widget writes)  ─────── depends on 2b

Phase 5 (legacy removal)  ─────── depends on all of Phase 4
```

## Risk Summary

| Phase              | Risk       | Reversibility           | Extension Impact            |
| ------------------ | ---------- | ----------------------- | --------------------------- |
| 0 (Foundation)     | None       | Fully reversible        | None                        |
| 1 (Types/World)    | Low        | New files, deletable    | None                        |
| 2 (Bridge)         | Low-Medium | Bridge is additive      | None                        |
| 3 (Systems)        | Low-Medium | Systems run in parallel | None                        |
| 4 (Write path)     | High       | Two-way sync is fragile | Callbacks must be preserved |
| 5 (Legacy removal) | Very High  | Irreversible            | Extensions must migrate     |

The plan is designed so that Phases 0-3 can ship without any risk to
extensions or existing behavior. Phase 4 is where the real migration begins,
and Phase 5 is the point of no return.
