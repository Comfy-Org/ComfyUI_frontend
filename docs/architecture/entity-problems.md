# Entity System Structural Problems

This document catalogs the structural problems in the current litegraph entity system. It provides the concrete "why" behind the ECS migration proposed in [ADR 0008](../adr/0008-entity-component-system.md). For the as-is relationship map, see [Entity Interactions](entity-interactions.md).

All file references are relative to `src/lib/litegraph/src/`.

## 1. God Objects

The three largest classes carry far too many responsibilities:

| Class          | Lines  | Responsibilities                                                                                                             |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `LGraphCanvas` | ~9,100 | Rendering, input handling, selection, link dragging, context menus, clipboard, undo/redo hooks, node layout triggers         |
| `LGraphNode`   | ~4,300 | Domain model, connectivity, serialization, rendering (slots, widgets, badges, title), layout, execution, property management |
| `LGraph`       | ~3,100 | Container management, serialization, canvas notification, subgraph lifecycle, execution ordering, link deduplication         |

`LGraphNode` alone has ~539 method/property definitions. A sampling of the concerns it mixes:

| Concern       | Examples                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Rendering     | `renderingColor` (line 328), `renderingBgColor` (line 335), `drawSlots()`, `drawWidgets()`, `measure(ctx)` (line 2074) |
| Serialization | `serialize()` (line 943), `configure()` (line 831), `toJSON()` (line 1033)                                             |
| Connectivity  | `connect()`, `connectSlots()`, `disconnectInput()`, `disconnectOutput()`                                               |
| Execution     | `execute()` (line 1418), `triggerSlot()`                                                                               |
| Layout        | `arrange()`, `_arrangeWidgets()`, `computeSize()`                                                                      |
| State mgmt    | `setProperty()`, `onWidgetChanged()`, direct `graph._version++`                                                        |

## 2. Circular Dependencies

**LGraph ↔ Subgraph**: `Subgraph` extends `LGraph`, but `LGraph` creates and manages `Subgraph` instances. This forces:

- A barrel export in `litegraph.ts` that re-exports 40+ modules with **order-dependent imports**
- An explicit comment at `litegraph.ts:15`: _"Must remain above LiteGraphGlobal (circular dependency due to abstract factory behaviour in 'configure')"_
- Test files must use the barrel import (`import { LGraph, Subgraph } from '.../litegraph'`) rather than direct imports, or they break

The `Subgraph` class is defined inside `LGraph.ts` (line 2761) rather than in its own file — a symptom of the circular dependency being unresolvable with the current class hierarchy.

## 3. Mixed Concerns

### Rendering in Domain Objects

`LGraphNode.measure()` (line 2074) accepts a `CanvasRenderingContext2D` parameter and sets `ctx.font` — a rendering operation embedded in what should be a domain model:

```
measure(ctx?: CanvasRenderingContext2D, options?: MeasureOptions): void {
  ...
  if (ctx) ctx.font = this.innerFontStyle
```

### State Mutation During Render

`LGraphCanvas.drawNode()` (line 5554) mutates node state as a side effect of rendering:

- Line 5562: `node._setConcreteSlots()` — rebuilds slot arrays
- Line 5564: `node.arrange()` — recalculates widget layout
- Lines 5653-5655: same mutations repeated for a second code path

This means the render pass is not idempotent — drawing a node changes its state.

### Store Dependencies in Domain Objects

`BaseWidget` (line 20-22) imports two Pinia stores at the module level:

- `usePromotionStore` — queried on every `getOutlineColor()` call
- `useWidgetValueStore` — widget state delegation via `setNodeId()`

Similarly, `LGraph` (lines 10-13) imports `useLayoutMutations`, `usePromotionStore`, and `useWidgetValueStore`. Domain objects should not have direct dependencies on UI framework stores.

### Serialization Interleaved with Container Logic

`LGraph.configure()` (line 2400) mixes deserialization, event dispatch, store clearing, and container state setup in a single 180-line method. A change to serialization format risks breaking container lifecycle, and vice versa.

## 4. Inconsistent ID Systems

### Ambiguous NodeId

```ts
export type NodeId = number | string // LGraphNode.ts:100
```

Most nodes use numeric IDs, but subgraph-related nodes use strings. Code must use runtime type guards (`typeof node.id === 'number'` at LGraph.ts:978, LGraphCanvas.ts:9045). This is a source of subtle bugs.

### Magic Numbers

```ts
export const SUBGRAPH_INPUT_ID = -10 // constants.ts:8
export const SUBGRAPH_OUTPUT_ID = -20 // constants.ts:11
```

Negative sentinel values in the ID space. Links check `origin_id === SUBGRAPH_INPUT_ID` to determine if they cross a subgraph boundary — a special case baked into the general-purpose `LLink` class.

### No Independent Widget or Slot IDs

**Widgets** are identified by `name + parent node`. Code searches by name in multiple places:

- `LGraphNode.ts:904` — `this.inputs.find((i) => i.widget?.name === w.name)`
- `LGraphNode.ts:4077` — `slot.widget.name === widget.name`
- `LGraphNode.ts:4086` — `this.widgets?.find((w) => w.name === slot.widget.name)`

If a widget is renamed, all these lookups silently break.

**Slots** are identified by their array index on the parent node. The serialized link format (`SerialisedLLinkArray`) stores slot indices:

```ts
type SerialisedLLinkArray = [
  id,
  origin_id,
  origin_slot,
  target_id,
  target_slot,
  type
]
```

If slots are reordered (e.g., by an extension adding a slot), all links referencing that node become stale.

### No Cross-Kind ID Safety

Nothing prevents passing a `LinkId` where a `NodeId` is expected — they're both `number`. This is the core motivation for the branded ID types proposed in ADR 0008.

## 5. Law of Demeter Violations

Entities routinely reach through their container to access internal state and sibling entities.

### Nodes Reaching Into Graph Internals

8+ locations in `LGraphNode` access the graph's private `_links` map directly:

- Line 877: `this.graph._links.get(input.link)`
- Line 891: `this.graph._links.get(linkId)`
- Line 1254: `const link_info = this.graph._links.get(input.link)`

Nodes also reach through the graph to access sibling nodes' slots:

- Line 1150: `this.graph.getNodeById(link.origin_id)` → read origin's outputs
- Line 1342: `this.graph.getNodeById(link.target_id)` → read target's inputs
- Line 1556: `node.inputs[link_info.target_slot]` (accessing a sibling's slot by index)

### Canvas Mutating Graph Internals

`LGraphCanvas` directly increments the graph's version counter:

- Line 3084: `node.graph._version++`
- Line 7880: `node.graph._version++`

The canvas also reaches through nodes to their container:

- Line 8337: `node.graph.remove(node)` — canvas deletes a node by reaching through the node to its graph

### Entities Mutating Container State

`LGraphNode` directly mutates `graph._version++` from 8+ locations (lines 833, 2989, 3138, 3176, 3304, 3539, 3550, 3567). There is no encapsulated method for signaling a version change — every call site manually increments the counter.

## 6. Scattered Side Effects

### Version Counter

`graph._version` is incremented from **15+ locations** across three files:

| File              | Locations                                           |
| ----------------- | --------------------------------------------------- |
| `LGraph.ts`       | Lines 956, 989, 1042, 1109, 2643                    |
| `LGraphNode.ts`   | Lines 833, 2989, 3138, 3176, 3304, 3539, 3550, 3567 |
| `LGraphCanvas.ts` | Lines 3084, 7880                                    |

No central mechanism exists. It's easy to forget an increment (stale render) or add a redundant one (wasted work).

### Module-Scope Store Access

Domain objects call Pinia composables at the module level or in methods, creating implicit dependencies on the Vue runtime:

- `LLink.ts:24` — `const layoutMutations = useLayoutMutations()` (module scope)
- `Reroute.ts` — same pattern at module scope
- `BaseWidget.ts:20-22` — imports `usePromotionStore` and `useWidgetValueStore`

These make the domain objects untestable without a Vue app context.

### Change Notification Sprawl

`beforeChange()` and `afterChange()` (undo/redo checkpoints) are called from
**12+ locations** in `LGraphCanvas` alone (lines 1574, 1592, 1604, 1620, 1752,
1770, 8754, 8760, 8771, 8777, 8803, 8811). These calls are grouping brackets:
misplaced or missing pairs can split one logical operation across multiple undo
entries, while unmatched extra calls can delay checkpoint emission until the
nesting counter returns to zero.

## 7. Render-Time Mutations

The render pass is not pure — it mutates state as a side effect:

| Location                            | Mutation                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `LGraphCanvas.drawNode()` line 5562 | `node._setConcreteSlots()` — rebuilds concrete slot arrays          |
| `LGraphCanvas.drawNode()` line 5564 | `node.arrange()` — recalculates widget positions and sizes          |
| `BaseWidget.getOutlineColor()`      | Queries `PromotionStore` on every frame                             |
| Link rendering                      | Caches `_pos` center point and `_centreAngle` on the LLink instance |

This means:

- Rendering order matters (later nodes see side effects from earlier nodes)
- Performance profiling conflates render cost with layout cost
- Concurrent or partial renders would produce inconsistent state

## How ECS Addresses These Problems

| Problem                | ECS Solution                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| God objects            | Data split into small, focused components; behavior lives in systems          |
| Circular dependencies  | Entities are just IDs; components have no inheritance hierarchy               |
| Mixed concerns         | Each system handles exactly one concern (render, serialize, execute)          |
| Inconsistent IDs       | Branded per-kind IDs with compile-time safety                                 |
| Demeter violations     | Systems query the World directly; no entity-to-entity references              |
| Scattered side effects | Version tracking becomes a system responsibility; stores become systems       |
| Render-time mutations  | Render system reads components without writing; layout system runs separately |
