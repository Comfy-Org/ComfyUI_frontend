# 8. Entity Component System

Date: 2026-03-23

## Status

Proposed

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

## Decision

Adopt an Entity Component System architecture for the graph domain model. This ADR defines the entity taxonomy, ID strategy, and component decomposition. Implementation will be incremental — existing classes remain untouched initially and will be migrated piecewise.

### Entity Taxonomy

Six entity kinds, each with a branded ID type:

| Entity Kind | Current Class(es)                                 | Current ID                  | Branded ID        |
| ----------- | ------------------------------------------------- | --------------------------- | ----------------- |
| Node        | `LGraphNode`                                      | `NodeId = number \| string` | `NodeEntityId`    |
| Link        | `LLink`                                           | `LinkId = number`           | `LinkEntityId`    |
| Widget      | `BaseWidget` subclasses (25+)                     | name + parent node          | `WidgetEntityId`  |
| Slot        | `SlotBase` / `INodeInputSlot` / `INodeOutputSlot` | index on parent node        | `SlotEntityId`    |
| Reroute     | `Reroute`                                         | `RerouteId = number`        | `RerouteEntityId` |
| Group       | `LGraphGroup`                                     | `number`                    | `GroupEntityId`   |

Subgraphs are not a separate entity kind. A subgraph is a node with a `SubgraphStructure` component. See [Subgraph Boundaries and Widget Promotion](../architecture/subgraph-boundaries-and-promotion.md) for the full design rationale.

### Branded ID Design

Each entity kind gets a nominal/branded type wrapping its underlying primitive. The brand prevents accidental cross-kind usage at compile time while remaining structurally compatible with existing ID types:

```ts
type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }
type WidgetEntityId = number & { readonly __brand: 'WidgetEntityId' }
type SlotEntityId = number & { readonly __brand: 'SlotEntityId' }
type RerouteEntityId = number & { readonly __brand: 'RerouteEntityId' }
type GroupEntityId = number & { readonly __brand: 'GroupEntityId' }

// Scope identifier, not an entity ID
type GraphId = string & { readonly __brand: 'GraphId' }
```

Widgets and Slots currently lack independent IDs. The ECS will assign synthetic IDs at entity creation time via an auto-incrementing counter (matching the pattern used by `lastNodeId`, `lastLinkId`, etc. in `LGraphState`).

### Component Decomposition

Components are plain data objects — no methods, no back-references to parent entities. Systems query components to implement behavior.

#### Shared Components

- **Position** — `{ pos: Point, size: Size, bounding: Rectangle }` — used by Node, Reroute, Group
- **Visual** — rendering properties specific to each entity kind (separate interfaces, shared naming convention)

#### Node

| Component         | Data (from `LGraphNode`)                            |
| ----------------- | --------------------------------------------------- |
| `Position`        | `pos`, `size`, `_bounding`                          |
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
| `Position`      | (shared)                          |
| `RerouteLinks`  | `parentId`, input/output link IDs |
| `RerouteVisual` | `color`, badge config             |

#### Group

| Component       | Data (from `LGraphGroup`)           |
| --------------- | ----------------------------------- |
| `Position`      | (shared)                            |
| `GroupMeta`     | `title`, `font`, `font_size`        |
| `GroupVisual`   | `color`                             |
| `GroupChildren` | child entity refs (nodes, reroutes) |

### World

A central registry (the "World") maps entity IDs to their component sets. One World exists per workflow, containing all entities across all nesting levels. Each entity carries a `graphScope` identifier linking it to its containing graph. The World also maintains a scope registry mapping each `graphId` to its parent (or null for the root graph).

### Systems (future work)

Systems are pure functions that query the World for entities with specific component combinations. Initial candidates:

- **RenderSystem** — queries `Position` + `*Visual` components
- **SerializationSystem** — queries all components to produce/consume workflow JSON
- **ExecutionSystem** — queries `Execution` + `Connectivity` to determine run order
- **LayoutSystem** — queries `Position` + structural components for auto-layout
- **SelectionSystem** — queries `Position` for hit-testing

System design is deferred to a future ADR.

### Migration Strategy

1. **Define types** — branded IDs, component interfaces, World type in a new `src/ecs/` directory
2. **Bridge layer** — adapter functions that read ECS components from existing class instances (zero-copy where possible)
3. **New features first** — any new cross-cutting feature (e.g., CRDT sync) builds on ECS components rather than class properties
4. **Incremental extraction** — migrate one component at a time from classes to the World, using the bridge layer for backward compatibility
5. **Deprecate class properties** — once all consumers read from the World, mark class properties as deprecated

### Alternatives Considered

- **Refactoring classes in place**: Lower initial cost, but doesn't solve the cross-cutting concern problem. Each new feature still requires modifying multiple god objects.
- **Full rewrite**: Higher risk, blocks feature work during migration. The incremental approach avoids this.
- **Using an existing ECS library** (e.g., bitecs, miniplex): Adds a dependency for a domain that is specific to this project. The graph domain's component shapes don't align well with the dense numeric arrays favored by game-oriented ECS libraries. A lightweight, purpose-built approach is preferred.

## Consequences

### Positive

- Cross-cutting concerns (undo/redo, CRDT sync, serialization) can be implemented as systems without modifying entity classes
- Components are independently testable — no need to construct an entire `LGraphNode` to test position logic
- Branded IDs prevent a class of bugs where IDs are accidentally used across entity kinds
- The World provides a single source of truth for all entity state, simplifying debugging and state inspection
- Aligns with the CRDT layout system direction from ADR 0003

### Negative

- Additional indirection: reading a node's position requires a World lookup instead of `node.pos`
- Learning curve for contributors unfamiliar with ECS patterns
- Migration period where both OOP and ECS patterns coexist, increasing cognitive load
- Widgets and Slots need synthetic IDs, adding ID management complexity

## Notes

- The 25+ widget types (`BooleanWidget`, `NumberWidget`, `ComboWidget`, etc.) will share the same ECS component schema. Widget-type-specific behavior lives in systems, not in component data.
- Subgraphs are not a separate entity kind. A `GraphId` scope identifier (branded `string`) tracks which graph an entity belongs to. The scope DAG must be acyclic — see [Subgraph Boundaries](../architecture/subgraph-boundaries-and-promotion.md).
- The existing `LGraphState.lastNodeId` / `lastLinkId` / `lastRerouteId` counters extend naturally to `lastWidgetId` and `lastSlotId`.
- The internal ECS model and the serialization format are deliberately separate concerns. The `SerializationSystem` translates between the flat World and the nested serialization format. Backward-compatible loading of all prior workflow formats is a hard, indefinite constraint.
