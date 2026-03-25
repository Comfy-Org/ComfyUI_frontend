# Entity Interactions (Current System)

This document maps the relationships and interaction patterns between all entity types in the litegraph layer as it exists today. It serves as a baseline for the ECS migration planned in [ADR 0008](../adr/0008-entity-component-system.md).

## Entities

| Entity   | Class         | ID Type         | Primary Location                              |
| -------- | ------------- | --------------- | --------------------------------------------- |
| Graph    | `LGraph`      | `UUID`          | `src/lib/litegraph/src/LGraph.ts`             |
| Node     | `LGraphNode`  | `NodeId`        | `src/lib/litegraph/src/LGraphNode.ts`         |
| Link     | `LLink`       | `LinkId`        | `src/lib/litegraph/src/LLink.ts`              |
| Subgraph | `Subgraph`    | `UUID`          | `src/lib/litegraph/src/LGraph.ts` (ECS: node component, not separate entity) |
| Widget   | `BaseWidget`  | name + nodeId   | `src/lib/litegraph/src/widgets/BaseWidget.ts` |
| Slot     | `SlotBase`    | index on parent | `src/lib/litegraph/src/node/SlotBase.ts`      |
| Reroute  | `Reroute`     | `RerouteId`     | `src/lib/litegraph/src/Reroute.ts`            |
| Group    | `LGraphGroup` | `number`        | `src/lib/litegraph/src/LGraphGroup.ts`        |

Under the ECS model, subgraphs are not a separate entity kind — they are nodes with `SubgraphStructure` and `SubgraphMeta` components. See [Subgraph Boundaries](subgraph-boundaries-and-promotion.md).

## 1. Overview

High-level ownership and reference relationships between all entities.

```mermaid
graph TD
    subgraph Legend
        direction LR
        L1[A] -->|owns| L2[B]
        L3[C] -.->|references| L4[D]
        L5[E] ==>|extends| L6[F]
    end

    Graph["LGraph
(UUID)"]
    Node["LGraphNode
(NodeId)"]
    SubgraphEntity["Subgraph
(UUID)"]
    SubgraphNode["SubgraphNode"]
    Link["LLink
(LinkId)"]
    Widget["BaseWidget
(name)"]
    Slot["SlotBase
(index)"]
    Reroute["Reroute
(RerouteId)"]
    Group["LGraphGroup
(number)"]
    Canvas["LGraphCanvas"]

    %% Ownership (solid)
    Graph -->|"_nodes[]"| Node
    Graph -->|"_links Map"| Link
    Graph -->|"reroutes Map"| Reroute
    Graph -->|"_groups[]"| Group
    Graph -->|"_subgraphs Map"| SubgraphEntity
    Node -->|"inputs[], outputs[]"| Slot
    Node -->|"widgets[]"| Widget

    %% Extends (thick)
    SubgraphEntity ==>|extends| Graph
    SubgraphNode ==>|extends| Node

    %% References (dashed)
    Link -.->|"origin_id, target_id"| Node
    Link -.->|"parentId"| Reroute
    Slot -.->|"link / links[]"| Link
    Reroute -.->|"linkIds"| Link
    Reroute -.->|"parentId"| Reroute
    Group -.->|"_children Set"| Node
    Group -.->|"_children Set"| Reroute
    SubgraphNode -.->|"subgraph"| SubgraphEntity
    Node -.->|"graph"| Graph
    Canvas -.->|"graph"| Graph
    Canvas -.->|"selectedItems"| Node
    Canvas -.->|"selectedItems"| Group
    Canvas -.->|"selectedItems"| Reroute
```

## 2. Connectivity

How Nodes, Slots, Links, and Reroutes form the graph topology.

```mermaid
graph LR
    subgraph OutputNode["Origin Node"]
        OSlot["Output Slot
links: LinkId[]"]
    end

    subgraph InputNode["Target Node"]
        ISlot["Input Slot
link: LinkId | null"]
    end

    OSlot -->|"LinkId ref"| Link["LLink
origin_id + origin_slot
target_id + target_slot
type: ISlotType"]
    Link -->|"LinkId ref"| ISlot

    Link -.->|"parentId"| R1["Reroute A"]
    R1 -.->|"parentId"| R2["Reroute B"]

    R1 -.-|"linkIds Set"| Link
    R2 -.-|"linkIds Set"| Link
```

### Subgraph Boundary Connections

```mermaid
graph TD
    subgraph ParentGraph["Parent Graph"]
        ExtNode["External Node"]
        SGNode["SubgraphNode
(in parent graph)"]
    end

    subgraph SubgraphDef["Subgraph"]
        SInput["SubgraphInput"]
        SInputNode["SubgraphInputNode
(virtual)"]
        InternalNode["Internal Node"]
        SOutputNode["SubgraphOutputNode
(virtual)"]
        SOutput["SubgraphOutput"]
    end

    ExtNode -->|"Link (parent graph)"| SGNode
    SGNode -.->|"maps to"| SInput
    SInput -->|"owns"| SInputNode
    SInputNode -->|"Link (subgraph)"| InternalNode
    InternalNode -->|"Link (subgraph)"| SOutputNode
    SOutputNode -->|"owned by"| SOutput
    SOutput -.->|"maps to"| SGNode
    SGNode -->|"Link (parent graph)"| ExtNode
```

### Floating Links (In-Progress Connections)

```mermaid
graph LR
    Slot["Source Slot"] -->|"drag starts"| FL["Floating LLink
origin_id=-1 or target_id=-1"]
    FL -->|"stored in"| FLMap["graph.floatingLinks Map"]
    FL -.->|"may pass through"| Reroute
    Reroute -.-|"floatingLinkIds Set"| FL
    FL -->|"on drop"| Permanent["Permanent LLink
(registered in graph._links)"]
```

## 3. Rendering

How LGraphCanvas draws each entity type.

```mermaid
graph TD
    Canvas["LGraphCanvas
render loop"]

    Canvas -->|"1. background"| DrawGroups["drawGroups()"]
    Canvas -->|"2. connections"| DrawConns["drawConnections()"]
    Canvas -->|"3. foreground"| DrawNodes["drawNode() per node"]
    Canvas -->|"4. in-progress"| DrawLC["LinkConnector.renderLinks"]

    DrawGroups --> Group["group.draw(canvas, ctx)"]

    DrawConns --> LinkSeg["LinkSegment interface"]
    LinkSeg --> Link["LLink path rendering"]
    LinkSeg --> RerouteRender["Reroute inline rendering
(draw, drawSlots)"]

    DrawNodes --> NodeDraw["node drawing pipeline"]
    NodeDraw -->|"drawSlots()"| SlotDraw["slot.draw() per slot"]
    NodeDraw -->|"drawWidgets()"| WidgetDraw["widget.drawWidget() per widget"]
    NodeDraw -->|"title, badges"| NodeChrome["title bar, buttons, badges"]

    DrawLC --> FloatingViz["Floating link visualization"]
```

### Rendering Order Detail

```mermaid
sequenceDiagram
    participant C as Canvas
    participant Gr as Groups
    participant L as Links/Reroutes
    participant N as Nodes
    participant S as Slots
    participant W as Widgets

    C->>Gr: drawGroups() — background layer
    Gr-->>C: group shapes + titles

    C->>L: drawConnections() — middle layer
    L-->>C: bezier paths + reroute dots

    loop each node (back to front)
        C->>N: drawNode()
        N->>N: drawNodeShape() (background, title)
        N->>S: drawSlots() (input/output circles)
        S-->>N: slot shapes + labels
        N->>W: drawWidgets() (if not collapsed)
        W-->>N: widget UI elements
        N-->>C: complete node
    end

    C->>C: overlay (tooltips, debug)
```

## 4. Lifecycle

Creation and destruction flows for each entity.

### Node Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: new LGraphNode(title)
    Created --> Configured: node.configure(data)
    Configured --> InGraph: graph.add(node)

    state InGraph {
        [*] --> Active
        Active --> Active: connect/disconnect slots
        Active --> Active: add/remove widgets
        Active --> Active: move, resize, collapse
    }

    InGraph --> Removed: graph.remove(node)
    Removed --> [*]

    note right of Created
        Constructor sets defaults.
        No graph reference yet.
    end note

    note right of InGraph
        node.onAdded(graph) called.
        ID assigned from graph.state.
        Slots may trigger onConnectionsChange.
    end note

    note right of Removed
        All links disconnected.
        node.onRemoved() called.
        Removed from graph._nodes.
    end note
```

### Link Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: node.connect() or connectSlots()
    Created --> Registered: graph._links.set(id, link)

    state Registered {
        [*] --> Active
        Active --> Active: data flows through
        Active --> Active: reroutes added/removed
    }

    Registered --> Disconnected: node.disconnectInput/Output()
    Disconnected --> Removed: link.disconnect(network)
    Removed --> [*]

    note right of Created
        new LLink(id, type, origin, slot, target, slot)
        Output slot.links[] updated.
        Input slot.link set.
    end note

    note right of Removed
        Removed from graph._links.
        Orphaned reroutes cleaned up.
        graph._version incremented.
    end note
```

### Widget Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: node.addWidget(type, name, value, options)
    Created --> Concrete: toConcreteWidget()
    Concrete --> Bound: widget.setNodeId(nodeId)

    state Bound {
        [*] --> Active
        Active --> Active: setValue() → store + node callback
        Active --> Active: draw(), onClick(), onDrag()
    }

    Bound --> Removed: node.removeWidget(widget)
    Removed --> [*]

    note right of Bound
        Registered in WidgetValueStore.
        State keyed by graphId:nodeId:name.
        Value reads/writes via store.
    end note
```

### Subgraph Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: graph.createSubgraph(data)

    state Created {
        [*] --> Defined
        Defined: registered in rootGraph._subgraphs
    }

    Created --> Instantiated: new SubgraphNode(subgraph)
    Instantiated --> InGraph: graph.add(subgraphNode)

    state InGraph {
        [*] --> Active
        Active --> Active: add/remove inputs/outputs
        Active --> Active: promote/demote widgets
        Active --> Active: edit internal nodes
    }

    InGraph --> Unpacked: graph.unpackSubgraph(node)
    Unpacked --> [*]

    InGraph --> NodeRemoved: graph.remove(subgraphNode)
    NodeRemoved --> MaybePurged: no other SubgraphNodes reference it?
    MaybePurged --> [*]

    note right of Instantiated
        SubgraphNode.subgraph = subgraph.
        Inputs/outputs synced from subgraph.
    end note

    note right of Unpacked
        Internal nodes cloned to parent.
        Links remapped. SubgraphNode removed.
        Subgraph def removed if unreferenced.
    end note
```

## 5. State Management

External stores and their relationships to entities.

```mermaid
graph TD
    subgraph Entities
        Node["LGraphNode"]
        Widget["BaseWidget"]
        Reroute["Reroute"]
        Link["LLink"]
        Graph["LGraph"]
        SGNode["SubgraphNode"]
    end

    subgraph Stores
        WVS["WidgetValueStore
(Pinia)"]
        PS["PromotionStore
(Pinia)"]
        LM["LayoutMutations
(composable)"]
    end

    subgraph GraphState["Graph Internal State"]
        Version["graph._version"]
        LGState["graph.state
(lastNodeId, lastLinkId,
lastRerouteId, lastGroupId)"]
    end

    %% WidgetValueStore
    Widget -->|"setNodeId() registers"| WVS
    Widget <-->|"value, label, disabled"| WVS
    WVS -.->|"keyed by graphId:nodeId:name"| Widget

    %% PromotionStore
    SGNode -->|"tracks promoted widgets"| PS
    Widget -.->|"isPromotedByAny() query"| PS

    %% LayoutMutations
    Node -->|"pos/size setter"| LM
    Reroute -->|"move()"| LM
    Link -->|"connectSlots()/disconnect()"| LM
    Graph -->|"add()/remove()"| LM

    %% Graph state
    Node -->|"connect/disconnect"| Version
    Widget -->|"setValue()"| Version
    Node -->|"collapse/toggleAdvanced"| Version
    Graph -->|"add/remove entities"| LGState
```

### Change Notification Flow

```mermaid
sequenceDiagram
    participant E as Entity (Node/Widget/Link)
    participant G as LGraph
    participant C as LGraphCanvas
    participant R as Render Loop

    E->>G: graph._version++
    E->>G: graph.beforeChange() (undo checkpoint)

    Note over E,G: ... mutation happens ...

    E->>G: graph.afterChange() (undo checkpoint)
    E->>G: graph.change()
    G->>C: canvasAction → canvas.setDirty(true, true)
    C->>R: dirty flags checked on next frame
    R->>C: full redraw
```

### Widget State Delegation

```mermaid
sequenceDiagram
    participant N as Node
    participant W as Widget
    participant S as WidgetValueStore
    participant G as Graph

    N->>W: addWidget(type, name, value)
    W->>W: toConcreteWidget()
    N->>W: setNodeId(nodeId)
    W->>S: registerWidget(graphId, state)
    S-->>W: state reference stored in widget._state

    Note over W,S: All value access now goes through store

    W->>S: widget.value = newVal (setter)
    S-->>S: store.state.value = newVal
    W->>N: node.onWidgetChanged?.(name, val)
    W->>G: graph._version++
```
