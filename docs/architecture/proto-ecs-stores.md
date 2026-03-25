# Proto-ECS: Existing State Extraction

The codebase has already begun extracting entity state into external Pinia stores — an organic, partial migration toward the ECS principles described in [ADR 0008](../adr/0008-entity-component-system.md). This document catalogs those stores, analyzes how they align with the ECS target, and identifies what remains to be extracted.

For the full problem analysis, see [Entity Problems](entity-problems.md). For the ECS target, see [ECS Target Architecture](ecs-target-architecture.md).

## 1. What's Already Extracted

Six stores extract entity state out of class instances into centralized, queryable registries:

| Store                   | Extracts From       | Scoping                       | Key Format                        | Data Shape                    |
| ----------------------- | ------------------- | ----------------------------- | --------------------------------- | ----------------------------- |
| WidgetValueStore        | `BaseWidget`        | `graphId → nodeId:name`       | `"${nodeId}:${widgetName}"`       | Plain `WidgetState` object    |
| PromotionStore          | `SubgraphNode`      | `graphId → nodeId → source[]` | `"${sourceNodeId}:${widgetName}"` | Ref-counted promotion entries |
| DomWidgetStore          | `BaseDOMWidget`     | Global                        | `widgetId` (UUID)                 | Position, visibility, z-index |
| LayoutStore             | Node, Link, Reroute | Workflow-level                | `nodeId`, `linkId`, `rerouteId`   | Y.js CRDT maps (pos, size)    |
| NodeOutputStore         | Execution results   | `nodeLocatorId`               | `"${subgraphId}:${nodeId}"`       | Output data, preview URLs     |
| SubgraphNavigationStore | Canvas viewport     | `subgraphId`                  | `subgraphId` or `'root'`          | LRU viewport cache            |

## 2. WidgetValueStore

**File:** `src/stores/widgetValueStore.ts`

The closest thing to a true ECS component store in the codebase today.

### State Shape

```
Map<UUID, Map<WidgetKey, WidgetState>>
     │              │           │
     graphId     "nodeId:name"  pure data object
```

`WidgetState` is a plain data object with no methods:

| Field       | Type             | Purpose                                    |
| ----------- | ---------------- | ------------------------------------------ |
| `nodeId`    | `NodeId`         | Owning node                                |
| `name`      | `string`         | Widget name                                |
| `type`      | `string`         | Widget type (e.g., `'number'`, `'toggle'`) |
| `value`     | `TWidgetValue`   | Current value                              |
| `label`     | `string?`        | Display label                              |
| `disabled`  | `boolean?`       | Disabled state                             |
| `serialize` | `boolean?`       | Whether to include in workflow JSON        |
| `options`   | `IWidgetOptions` | Configuration                              |

### Two-Phase Delegation

**Phase 1 — Construction:** Widget creates a local `_state` object with initial values.

**Phase 2 — `setNodeId()`:** Widget replaces its `_state` with a reference to the store's object:

```
widget._state = useWidgetValueStore().registerWidget(graphId, { ...this._state, nodeId })
```

After registration, the widget's getters/setters (`value`, `label`, `disabled`) are pass-throughs to the store. Mutations to the widget automatically sync to the store via shared object reference.

### What's Extracted vs What Remains

```mermaid
graph LR
    subgraph Extracted["Extracted to Store"]
        style Extracted fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
        V["value"]
        L["label"]
        D["disabled"]
        S["serialize"]
        O["options (ref)"]
    end

    subgraph Remains["Remains on Class"]
        style Remains fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
        Node["_node (back-ref)"]
        Draw["drawWidget(), drawWidgetShape()"]
        Events["onClick(), onDrag(), onPointerDown()"]
        Layout["y, computedHeight, width"]
        CB["callback, linkedWidgets"]
        DOM["element (DOM widgets)"]
    end

    BW["BaseWidget"] --> Extracted
    BW --> Remains
```

### ECS Alignment

| Aspect                      | ECS-like | Why                                               |
| --------------------------- | -------- | ------------------------------------------------- |
| `WidgetState` is plain data | Yes      | No methods, serializable, reactive                |
| Graph-scoped lifecycle      | Yes      | `clearGraph(graphId)` cleans up                   |
| Query API                   | Yes      | `getWidget()`, `getNodeWidgets()`                 |
| Cross-subgraph sync         | Yes      | Same nodeId:name shares state across depths       |
| Back-reference (`_node`)    | **No**   | Widget still holds owning node ref                |
| Behavior on class           | **No**   | Drawing, events, callbacks still on widget        |
| Module-scope store access   | **No**   | `useWidgetValueStore()` called from domain object |

## 3. PromotionStore

**File:** `src/stores/promotionStore.ts`

Extracts subgraph widget promotion decisions into a centralized, ref-counted registry.

### State Shape

```
graphPromotions:  Map<UUID, Map<NodeId, PromotedWidgetSource[]>>
                       │          │              │
                    graphId    subgraphNodeId   ordered promotion entries

graphRefCounts:   Map<UUID, Map<string, number>>
                       │          │        │
                    graphId    entryKey   count of nodes promoting this widget
```

### Ref-Counting for O(1) Queries

The store maintains a parallel ref-count map. When a widget is promoted on a SubgraphNode, the ref count for that entry key increments. When demoted, it decrements. This enables:

```ts
isPromotedByAny(graphId, { sourceNodeId, sourceWidgetName }): boolean
// O(1) lookup: refCounts.get(key) > 0
```

Without ref counting, this query would require scanning all SubgraphNodes in the graph.

### View Reconciliation Layer

`PromotedWidgetViewManager` (`src/lib/litegraph/src/subgraph/PromotedWidgetViewManager.ts`) sits between the store and the UI:

```mermaid
graph LR
    PS["PromotionStore
(data)"] -->|"entries"| VM["PromotedWidgetViewManager
(reconciliation)"] -->|"stable views"| PV["PromotedWidgetView
(proxy widget)"]
    PV -->|"resolveDeepest()"| CW["Concrete Widget
(leaf node)"]
    PV -->|"reads value"| WVS["WidgetValueStore"]
```

The manager maintains a `viewCache` to preserve object identity across updates — a reconciliation pattern similar to React's virtual DOM diffing.

### ECS Alignment

| Aspect                             | ECS-like  | Why                                                                     |
| ---------------------------------- | --------- | ----------------------------------------------------------------------- |
| Data separated from views          | Yes       | Store holds entries; ViewManager holds UI proxies                       |
| Ref-counted queries                | Yes       | Efficient global state queries without scanning                         |
| Graph-scoped lifecycle             | Yes       | `clearGraph(graphId)`                                                   |
| View reconciliation                | Partially | ViewManager is a system-like layer, but tightly coupled to SubgraphNode |
| SubgraphNode drives mutations      | **No**    | Entity class calls `store.setPromotions()` directly                     |
| BaseWidget queries store in render | **No**    | `getOutlineColor()` calls `isPromotedByAny()` every frame               |

## 4. LayoutStore (CRDT)

**File:** `src/renderer/core/layout/store/layoutStore.ts`

The most architecturally advanced extraction — uses Y.js CRDTs for collaboration-ready position state.

### State Shape

```
ynodes:    Y.Map<NodeLayoutMap>     // nodeId → { pos, size, zIndex, bounds }
ylinks:    Y.Map<Y.Map<...>>       // linkId → link layout data
yreroutes: Y.Map<Y.Map<...>>       // rerouteId → reroute layout data
```

### Write API

`useLayoutMutations()` (`src/renderer/core/layout/operations/layoutMutations.ts`) provides the mutation API:

- `moveNode(graphId, nodeId, pos)`
- `resizeNode(graphId, nodeId, size)`
- `setNodeZIndex(graphId, nodeId, zIndex)`
- `createLink(graphId, linkId, ...)`
- `removeLink(graphId, linkId)`
- `moveReroute(graphId, rerouteId, pos)`

### The Scattered Access Problem

This composable is called at **module scope** in domain objects:

- `LLink.ts:24` — `const layoutMutations = useLayoutMutations()`
- `Reroute.ts` — same pattern
- `LGraphNode.ts` — imported and called in methods

These module-scope calls create implicit dependencies on the Vue runtime and make the domain objects untestable without a full app context.

### ECS Alignment

| Aspect                       | ECS-like  | Why                                                 |
| ---------------------------- | --------- | --------------------------------------------------- |
| Position data extracted      | Yes       | Closest to the ECS `Position` component             |
| CRDT-ready                   | Yes       | Enables collaboration (ADR 0003)                    |
| Covers multiple entity kinds | Yes       | Nodes, links, reroutes in one store                 |
| Mutation API (composable)    | Partially | System-like, but called from entities, not a system |
| Module-scope access          | **No**    | Domain objects import store at module level         |
| No entity ID branding        | **No**    | Plain numbers, no type safety across kinds          |

## 5. Pattern Analysis

### What These Stores Have in Common (Proto-ECS)

1. **Plain data objects**: `WidgetState`, `DomWidgetState`, CRDT maps are all methods-free data
2. **Centralized registries**: Each store is a `Map<key, data>` — structurally identical to an ECS component store
3. **Graph-scoped lifecycle**: `clearGraph(graphId)` for cleanup (WidgetValueStore, PromotionStore)
4. **Query APIs**: `getWidget()`, `isPromotedByAny()`, `getNodeWidgets()` — system-like queries
5. **Separation of data from behavior**: The stores hold data; classes retain behavior

### What's Missing vs Full ECS

```mermaid
graph TD
    subgraph Have["What We Have"]
        style Have fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
        H1["Centralized data stores"]
        H2["Plain data components
(WidgetState, LayoutMap)"]
        H3["Query APIs
(getWidget, isPromotedByAny)"]
        H4["Graph-scoped lifecycle"]
        H5["Partial position extraction
(LayoutStore)"]
    end

    subgraph Missing["What's Missing"]
        style Missing fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
        M1["Unified World
(6 stores, 6 keying strategies)"]
        M2["Branded entity IDs
(keys are string concatenations)"]
        M3["System layer
(mutations from anywhere)"]
        M4["Complete extraction
(behavior still on classes)"]
        M5["No entity-to-entity refs
(back-refs remain)"]
        M6["Render/update separation
(stores queried during render)"]
    end
```

### Keying Strategy Comparison

Each store invents its own identity scheme:

| Store            | Key Format                        | Entity ID Used          | Type-Safe? |
| ---------------- | --------------------------------- | ----------------------- | ---------- |
| WidgetValueStore | `"${nodeId}:${widgetName}"`       | NodeId (number\|string) | No         |
| PromotionStore   | `"${sourceNodeId}:${widgetName}"` | NodeId (string-coerced) | No         |
| DomWidgetStore   | Widget UUID                       | UUID (string)           | No         |
| LayoutStore      | Raw nodeId/linkId/rerouteId       | Mixed number types      | No         |
| NodeOutputStore  | `"${subgraphId}:${nodeId}"`       | Composite string        | No         |

In the ECS target, all of these would use branded entity IDs (`WidgetEntityId`, `NodeEntityId`, etc.) with compile-time cross-kind protection.

## 6. Extraction Map

Current state of extraction for each entity kind:

```mermaid
graph TD
    subgraph Node["LGraphNode"]
        N_ext["Extracted:
- pos, size → LayoutStore
- zIndex → LayoutStore"]
        N_rem["Remains on class:
- type, category, nodeData
- color, bgcolor, boxcolor
- inputs[], outputs[]
- widgets[]
- properties
- order, mode, flags
- serialize(), configure()
- drawSlots(), drawWidgets()
- connect(), disconnect()"]
    end

    subgraph Widget["BaseWidget"]
        W_ext["Extracted:
- value → WidgetValueStore
- label → WidgetValueStore
- disabled → WidgetValueStore
- promotion status → PromotionStore
- DOM pos/vis → DomWidgetStore"]
        W_rem["Remains on class:
- _node back-ref
- drawWidget()
- onClick(), onDrag()
- computedHeight
- callback, linkedWidgets"]
    end

    subgraph Link["LLink"]
        L_ext["Extracted:
- layout data → LayoutStore"]
        L_rem["Remains on class:
- origin_id, target_id
- origin_slot, target_slot
- type, color, path
- data, _dragging
- disconnect(), resolve()"]
    end

    subgraph Reroute["Reroute"]
        R_ext["Extracted:
- pos → LayoutStore"]
        R_rem["Remains on class:
- parentId, linkIds
- floatingLinkIds
- color, draw()
- findSourceOutput()"]
    end

    subgraph Group["LGraphGroup"]
        G_ext["Extracted:
(nothing)"]
        G_rem["Remains on class:
- pos, size, bounding
- title, font, color
- _children, _nodes
- draw(), move()
- recomputeInsideNodes()"]
    end

    subgraph Subgraph["Subgraph"]
        S_ext["Extracted:
- promotions → PromotionStore"]
        S_rem["Remains on class:
- name, description
- inputs[], outputs[]
- inputNode, outputNode
- All LGraph state"]
    end

    style N_ext fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
    style W_ext fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
    style L_ext fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
    style R_ext fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
    style G_ext fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style S_ext fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0

    style N_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style W_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style L_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style R_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style G_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style S_rem fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
```

## 7. Migration Gap Analysis

What each entity needs to reach the ECS target from [ADR 0008](../adr/0008-entity-component-system.md):

| Entity       | Already Extracted                                                                                 | Still on Class                                                                       | ECS Target Components                                                                | Gap                                                        |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Node**     | pos, size (LayoutStore)                                                                           | type, visual, connectivity, execution, properties, widgets, rendering, serialization | Position, NodeVisual, NodeType, Connectivity, Execution, Properties, WidgetContainer | Large — 6 components unextracted, all behavior on class    |
| **Link**     | layout (LayoutStore)                                                                              | endpoints, visual, state, connectivity methods                                       | LinkEndpoints, LinkVisual, LinkState                                                 | Medium — 3 components unextracted                          |
| **Widget**   | value, label, disabled (WidgetValueStore); promotion (PromotionStore); DOM state (DomWidgetStore) | node back-ref, rendering, events, layout                                             | WidgetIdentity, WidgetValue, WidgetLayout                                            | Small — value extraction done; rendering and layout remain |
| **Slot**     | (nothing)                                                                                         | name, type, direction, link refs, visual, position                                   | SlotIdentity, SlotConnection, SlotVisual                                             | Full — no extraction started                               |
| **Reroute**  | pos (LayoutStore)                                                                                 | links, visual, chain traversal                                                       | Position, RerouteLinks, RerouteVisual                                                | Medium — position done, rest unextracted                   |
| **Group**    | (nothing)                                                                                         | pos, size, meta, visual, children                                                    | Position, GroupMeta, GroupVisual, GroupChildren                                      | Full — no extraction started                               |
| **Subgraph** | promotions (PromotionStore)                                                                       | structure, meta, I/O, all LGraph state                                               | SubgraphStructure, SubgraphMeta                                                      | Large — mostly unextracted                                 |

### Priority Order for Extraction

Based on existing progress and problem severity:

1. **Widget** — closest to done (value extraction complete, needs rendering/layout extraction)
2. **Node Position** — already in LayoutStore, needs branded ID and formal component type
3. **Link** — small component set, high coupling pain
4. **Slot** — no extraction yet, but small and self-contained
5. **Reroute** — partially extracted, moderate complexity
6. **Group** — no extraction, but least coupled to other entities
7. **Subgraph** — most complex, depends on Node and Link extraction first
