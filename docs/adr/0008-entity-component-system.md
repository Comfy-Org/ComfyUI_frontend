# 8. Entity Component System

Date: 2026-03-23

## Status

Proposed

### Amendment (2026-06-19, PR 12617)

The single central registry this ADR calls the "World" was superseded during
implementation. Runtime entity data is held in dedicated Pinia stores keyed by
string IDs — `widgetValueStore`, `domWidgetStore`, `layoutStore`,
`nodeOutputStore`, `subgraphNavigationStore`, and `previewExposureStore`.
Widget values are keyed by `WidgetId` (`graphId:nodeId:name`, see
`src/types/widgetId.ts`); the `world/*` layer (`widgetValueIO`, `entityIds`,
`brand`, `WidgetEntityId`) was deleted. The ECS principles below still hold —
plain-data components, separation of data from behavior, command-driven
mutation, and no god-object growth — realized across those stores. Where the
text below says "the World," read "the set of dedicated stores"; where it shows
`world.getComponent(id, Component)`, read the matching store getter (for
example `widgetValueStore.getWidget(widgetId)`).

## Context

The litegraph layer is built on deeply coupled OOP classes (`LGraphNode`, `LLink`, `Subgraph`, `BaseWidget`, `Reroute`, `LGraphGroup`, `SlotBase`). Each entity directly references its container and children — nodes hold widget arrays, widgets back-reference their node, links reference origin/target node IDs, subgraphs extend the graph class, and so on.

This coupling makes it difficult to:

- Add cross-cutting concerns (undo/redo, serialization, multiplayer CRDT sync, rendering optimization) without modifying every class
- Test individual aspects of an entity in isolation
- Evolve rendering, serialization, and execution logic independently
- Implement the CRDT-based layout system proposed in [ADR 0003](0003-crdt-based-layout-system.md)

An Entity Component System (ECS) separates **identity** (entities), **data** (components), and **behavior** (systems), enabling each concern to evolve independently.

### Current pain points

- **God objects**: `LGraphNode` (~2000+ lines) mixes position, rendering, connectivity, execution, serialization, and input handling
- **Circular dependencies**: `LGraph` ↔ `Subgraph`, `LGraphNode` ↔ `LGraphCanvas`, requiring careful import ordering and barrel exports
- **Tight rendering coupling**: Visual properties (color, position, bounding rect) are interleaved with domain logic (execution order, slot types)
- **No unified entity model**: Each entity kind uses different ID types, ownership patterns, and lifecycle management

For the full problem catalog with line-level code references, see [Entity System Structural Problems](../architecture/entity-problems.md). For a map of all current entity relationships, see [Entity Interactions](../architecture/entity-interactions.md).

## Decision

Adopt an Entity Component System architecture for the graph domain model. This ADR defines the entity taxonomy, ID strategy, and component decomposition. Implementation will be incremental — existing classes remain untouched initially and will be migrated piecewise.

### Entity Taxonomy

Six entity kinds, each with a branded ID type:

| Entity Kind | Current Class(es)                                 | Current ID                  | Branded ID        |
| ----------- | ------------------------------------------------- | --------------------------- | ----------------- |
| Node        | `LGraphNode`                                      | `NodeId = number \| string` | `NodeEntityId`    |
| Link        | `LLink`                                           | `LinkId = number`           | `LinkEntityId`    |
| Widget      | `BaseWidget` subclasses (25+)                     | name + parent node          | `WidgetId`        |
| Slot        | `SlotBase` / `INodeInputSlot` / `INodeOutputSlot` | index on parent node        | `SlotEntityId`    |
| Reroute     | `Reroute`                                         | `RerouteId = number`        | `RerouteEntityId` |
| Group       | `LGraphGroup`                                     | `number`                    | `GroupEntityId`   |

Subgraphs are not a separate entity kind. A subgraph is a node with a `SubgraphStructure` component. See [Subgraph Boundaries and Widget Promotion](../architecture/subgraph-boundaries-and-promotion.md) for the full design rationale.

### Branded ID Design

Each entity kind gets a nominal/branded type wrapping its underlying primitive. The brand prevents accidental cross-kind usage at compile time while remaining structurally compatible with existing ID types:

```ts
type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }
type SlotEntityId = number & { readonly __brand: 'SlotEntityId' }
type RerouteEntityId = number & { readonly __brand: 'RerouteEntityId' }
type GroupEntityId = number & { readonly __brand: 'GroupEntityId' }

// Scope identifier, not an entity ID
type GraphId = string & { readonly __brand: 'GraphId' }
```

> **Amended (PR 12617):** Widgets are keyed by a branded composite **string**,
> `WidgetId = graphId:nodeId:name` (`src/types/widgetId.ts`), rather than a
> synthetic numeric `WidgetEntityId`. The composite stays self-documenting and
> survives renames at the store layer. The numeric per-kind brands above for
> Node/Link/Reroute/Group remain aspirational and unshipped; treat them as
> design intent. Slots have no independent ID yet.

### Component Decomposition

Components are plain data objects — no methods, no back-references to parent entities. Systems query components to implement behavior.

#### Shared Components

- **Position** — `{ pos: Point }` — used by Node, Reroute, Group
- **Dimensions** — `{ size: Size, bounding: Rectangle }` — used by Node, Group
- **Visual** — rendering properties specific to each entity kind (separate interfaces, shared naming convention)

#### Node

| Component         | Data (from `LGraphNode`)                            |
| ----------------- | --------------------------------------------------- |
| `Position`        | `pos`                                               |
| `Dimensions`      | `size`, `_bounding`                                 |
| `NodeVisual`      | `color`, `bgcolor`, `boxcolor`, `title`             |
| `NodeType`        | `type`, `category`, `nodeData`, `description`       |
| `Connectivity`    | slot entity refs (replaces `inputs[]`, `outputs[]`) |
| `Execution`       | `order`, `mode`, `flags`                            |
| `Properties`      | `properties`, `properties_info`                     |
| `WidgetContainer` | widget entity refs (replaces `widgets[]`)           |

#### Link

| Component       | Data (from `LLink`)                                            |
| --------------- | -------------------------------------------------------------- |
| `LinkEndpoints` | `origin_id`, `origin_slot`, `target_id`, `target_slot`, `type` |
| `LinkVisual`    | `color`, `path`, `_pos` (center point)                         |
| `LinkState`     | `_dragging`, `data`                                            |

#### Subgraph (Node Components)

A node carrying a subgraph gains these additional components. Subgraphs are not a separate entity kind — see [Subgraph Boundaries](../architecture/subgraph-boundaries-and-promotion.md).

| Component           | Data                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `SubgraphStructure` | `graphId`, typed interface (input/output names, types, slot entity refs) |
| `SubgraphMeta`      | `name`, `description`                                                    |

#### Widget

| Component        | Data (from `BaseWidget`)                                    |
| ---------------- | ----------------------------------------------------------- |
| `WidgetIdentity` | `name`, `type` (widget type string), parent node entity ref |
| `WidgetValue`    | `value`, `options`, `serialize` flags                       |
| `WidgetLayout`   | `computedHeight`, layout size constraints                   |

#### Slot

| Component        | Data (from `SlotBase` / `INodeInputSlot` / `INodeOutputSlot`)                       |
| ---------------- | ----------------------------------------------------------------------------------- |
| `SlotIdentity`   | `name`, `type` (slot type), direction (`input` or `output`), parent node ref, index |
| `SlotConnection` | `link` (input) or `links[]` (output), `widget` locator                              |
| `SlotVisual`     | `pos`, `boundingRect`, `color_on`, `color_off`, `shape`                             |

#### Reroute

| Component       | Data (from `Reroute`)             |
| --------------- | --------------------------------- |
| `Position`      | `pos` (shared)                    |
| `RerouteLinks`  | `parentId`, input/output link IDs |
| `RerouteVisual` | `color`, badge config             |

#### Group

| Component       | Data (from `LGraphGroup`)           |
| --------------- | ----------------------------------- |
| `Position`      | `pos` (shared)                      |
| `Dimensions`    | `size`, `bounding`                  |
| `GroupMeta`     | `title`, `font`, `font_size`        |
| `GroupVisual`   | `color`                             |
| `GroupChildren` | child entity refs (nodes, reroutes) |

### Dedicated stores

Component data lives in a set of dedicated Pinia stores, each owning one
concern and keyed by a string ID that embeds its graph scope (for example
`widgetValueStore` keyed by `WidgetId = graphId:nodeId:name`, `layoutStore`
keyed by `nodeId`/`linkId`/`rerouteId`, `nodeOutputStore` keyed by
`subgraphId:nodeId`). Each store provides a clear-by-graph lifecycle hook
(`clearGraph(graphId)`) and query helpers. A scope registry maps each `graphId`
to its parent (or null for the root graph).

> The original design centralized this in one "World" registry per workflow
> instance; PR 12617 replaced that with the dedicated stores above. The
> remainder of this section describes scoping, which applies per store.

The "single source of truth" claim in this ADR is scoped to one workflow
instance, per concern. In a future linked-subgraph model, shared definitions
can be loaded into multiple workflow instances, but mutable runtime state
(widget values, execution state, selection, transient layout caches) remains
instance-scoped unless explicitly declared shareable.

### Subgraph recursion model

The ECS model preserves recursive nesting without inheritance. A subgraph node
stores `SubgraphStructure.childGraphId`, and the scope registry stores
`childGraphId -> parentGraphId`. This forms a DAG that can represent arbitrary
subgraph depth.

Queries such as "all nodes at depth N" run by traversing the scope registry
from the root, materializing graph IDs at depth `N`, and then filtering entity
queries by `graphScope`.

### Systems (future work)

Systems are pure functions that query the relevant store(s) for entities with specific component combinations. Initial candidates:

- **RenderSystem** — queries `Position` + `Dimensions` (where present) + `*Visual` components
- **SerializationSystem** — queries all components to produce/consume workflow JSON
- **ExecutionSystem** — queries `Execution` + `Connectivity` to determine run order
- **LayoutSystem** — queries `Position` + `Dimensions` + structural components for auto-layout
- **SelectionSystem** — queries `Position` for point entities and `Position` + `Dimensions` for box hit-testing

System design is deferred to a future ADR. For detailed before/after walkthroughs of how lifecycle operations (node removal, link creation, subgraph nesting, etc.) transform under ECS, see [ECS Lifecycle Scenarios](../architecture/ecs-lifecycle-scenarios.md).

### Migration Strategy

1. **Define types** — string-key ID types (for example `WidgetId`) and plain-data component interfaces, owned by the store for each concern
2. **Bridge layer** — adapter functions that read component data from existing class instances (zero-copy where possible)
3. **New features first** — any new cross-cutting feature (e.g., CRDT sync) builds on store-backed components rather than class properties
4. **Incremental extraction** — migrate one component at a time from classes into its dedicated store, using the bridge layer for backward compatibility
5. **Deprecate class properties** — once all consumers read from the store, mark class properties as deprecated

For the phased migration roadmap with shipping milestones, see [ECS Migration Plan](../architecture/ecs-migration-plan.md). For the full target architecture, see [ECS Target Architecture](../architecture/ecs-target-architecture.md). For an inventory of existing stores that already partially implement ECS patterns, see [Proto-ECS Stores](../architecture/proto-ecs-stores.md).

### Relationship to ADR 0003 (Command Pattern / CRDT)

[ADR 0003](0003-crdt-based-layout-system.md) establishes that all mutations flow through serializable, idempotent commands. This ADR (0008) defines the entity data model and the dedicated stores that hold it. They are complementary architectural layers:

- **Commands** (ADR 0003) describe mutation intent — serializable objects that can be logged, replayed, sent over a wire, or undone.
- **Systems** (ADR 0008) are command handlers — they validate and execute mutations against the relevant stores.
- **The dedicated stores** (ADR 0008) hold component data and expose mutation APIs (for example `useLayoutMutations()`, `widgetValueStore.setValue`); each owns its own transaction boundary.

A store's imperative mutators are internal implementation. External callers submit commands; each mutating store wraps its writes in a transaction (the Y.js-backed `layoutStore` already does this). This follows Redux: internal mutation is imperative, while the public API is action-based.

### Alternatives Considered

- **Refactoring classes in place**: Lower initial cost, but doesn't solve the cross-cutting concern problem. Each new feature still requires modifying multiple god objects.
- **Full rewrite**: Higher risk, blocks feature work during migration. The incremental approach avoids this.
- **Using an existing ECS library** (e.g., bitecs, miniplex): Adds a dependency for a domain that is specific to this project. The graph domain's component shapes don't align well with the dense numeric arrays favored by game-oriented ECS libraries. A lightweight, purpose-built approach is preferred.

## Consequences

### Positive

- Cross-cutting concerns (undo/redo, CRDT sync, serialization) can be implemented as systems without modifying entity classes
- Components are independently testable — no need to construct an entire `LGraphNode` to test position logic
- Branded IDs (including the composite `WidgetId` string) prevent a class of bugs where IDs are accidentally used across entity kinds
- Each dedicated store provides a single source of truth for its concern inside a workflow instance, simplifying debugging and state inspection
- Aligns with the CRDT layout system direction from ADR 0003

### Negative

- Additional indirection: reading a node's position requires a store lookup instead of `node.pos`
- Learning curve for contributors unfamiliar with ECS patterns
- Migration period where both OOP and ECS patterns coexist, increasing cognitive load
- Widgets and Slots need synthetic IDs, adding ID management complexity

### Render-Loop Performance Implications and Mitigations

Replacing direct property reads (`node.pos`) with store lookups (for example `layoutStore` position reads) does add per-read overhead in the hot render path. In modern JS engines, hot `Map.get()` paths are heavily optimized and are often within a low constant factor of object property reads, but this ADR treats render-loop cost as a first-class risk rather than assuming it is free.

Planned mitigations for the ECS render path:

1. Pre-collect render queries into frame-stable caches (`visibleNodeIds`, `visibleLinkIds`, and resolved component references) and rebuild only on topology/layout dirty signals, not on every draw call.
2. Keep archetype-style buckets for common render signatures (for example: `Node = Position+Dimensions+NodeVisual`, `Reroute = Position+RerouteVisual`) so systems iterate arrays instead of probing unrelated entities.
3. Allow a hot-path storage upgrade behind a store's API (for example, SoA-style typed arrays for `Position` and `Dimensions`) if profiling shows `Map.get()` dominates frame time.
4. Gate migration of each render concern with profiling parity checks against the legacy path (same workflow, same viewport, same frame budget).
5. Treat parity as a release gate: ECS render path must stay within agreed frame-time budgets (for example, no statistically significant regression in p95 frame time on representative 200-node and 500-node workflows).

The design goal is to preserve ECS modularity while keeping render throughput within existing frame-time budgets.

## Supporting Documents

Companion architecture documents that expand on the design in this ADR:

| Document                                                                                         | Description                                                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [Entity Interactions](../architecture/entity-interactions.md)                                    | Maps all current entity relationships and interaction patterns — the ECS migration baseline              |
| [Entity System Structural Problems](../architecture/entity-problems.md)                          | Detailed problem catalog with line-level code references motivating the ECS migration                    |
| [Proto-ECS Stores](../architecture/proto-ecs-stores.md)                                          | Inventory of existing Pinia stores that already partially implement ECS patterns                         |
| [ECS Target Architecture](../architecture/ecs-target-architecture.md)                            | Full target architecture showing how entities and interactions transform under ECS                       |
| [ECS Migration Plan](../architecture/ecs-migration-plan.md)                                      | Phased migration roadmap with shipping milestones and go/no-go criteria                                  |
| [ECS Lifecycle Scenarios](../architecture/ecs-lifecycle-scenarios.md)                            | Before/after walkthroughs of lifecycle operations (node removal, link creation, etc.)                    |
| [Subgraph Boundaries and Widget Promotion](../architecture/subgraph-boundaries-and-promotion.md) | Design rationale for modeling subgraphs as node components, not separate entities                        |
| [ADR 0009: Subgraph promoted widgets](0009-subgraph-promoted-widgets-use-linked-inputs.md)       | Follow-up decision for promoted widget identity and value ownership at subgraph boundaries               |
| [Appendix: Critical Analysis](../architecture/appendix-critical-analysis.md)                     | Independent verification of the accuracy of the architecture documents                                   |
| [Appendix: ECS Pattern Survey](../architecture/appendix-ecs-pattern-survey.md)                   | Survey of bitECS, miniplex, koota, ECSY, Thyseus, and Bevy — patterns adopted, departed, when to revisit |
| [Change Tracker](../architecture/change-tracker.md)                                              | Documents the current undo/redo system that ECS cross-cutting concerns will replace                      |

## Notes

- The 25+ widget types (`BooleanWidget`, `NumberWidget`, `ComboWidget`, etc.) will share the same ECS component schema. Widget-type-specific behavior lives in systems, not in component data.
- Subgraphs are not a separate entity kind. A `GraphId` scope identifier (branded `string`) tracks which graph an entity belongs to. The scope DAG must be acyclic — see [Subgraph Boundaries](../architecture/subgraph-boundaries-and-promotion.md).
- Widgets are addressed by the composite `WidgetId` string, so they need no synthetic counter. The existing `LGraphState.lastNodeId` / `lastLinkId` / `lastRerouteId` counters cover the kinds that have numeric IDs.
- The internal ECS model and the serialization format are deliberately separate concerns. The `SerializationSystem` translates between the store-backed component data and the nested serialization format. Backward-compatible loading of all prior workflow formats is a hard, indefinite constraint.
