# ECS Target Architecture

This document describes the target ECS architecture for the litegraph entity system. It shows how the entities and interactions from the [current system](entity-interactions.md) transform under ECS, and how the [structural problems](entity-problems.md) are resolved. For the full design rationale, see [ADR 0008](../adr/0008-entity-component-system.md).

## 1. World Overview

The World is the single source of truth for all entity state. Entities are just branded IDs. Components are plain data objects. Systems are functions that query the World.

```mermaid
graph TD
    subgraph World["World (Central Registry)"]
        direction TB
        NodeStore["Nodes
        Map&lt;NodeEntityId, NodeComponents&gt;"]
        LinkStore["Links
        Map&lt;LinkEntityId, LinkComponents&gt;"]
        SubgraphStore["Subgraphs
        Map&lt;SubgraphEntityId, SubgraphComponents&gt;"]
        WidgetStore["Widgets
        Map&lt;WidgetEntityId, WidgetComponents&gt;"]
        SlotStore["Slots
        Map&lt;SlotEntityId, SlotComponents&gt;"]
        RerouteStore["Reroutes
        Map&lt;RerouteEntityId, RerouteComponents&gt;"]
        GroupStore["Groups
        Map&lt;GroupEntityId, GroupComponents&gt;"]
    end

    subgraph Systems["Systems (Behavior)"]
        direction TB
        RS["RenderSystem"]
        SS["SerializationSystem"]
        CS["ConnectivitySystem"]
        LS["LayoutSystem"]
        ES["ExecutionSystem"]
        VS["VersionSystem"]
    end

    RS -->|reads| World
    SS -->|reads/writes| World
    CS -->|reads/writes| World
    LS -->|reads/writes| World
    ES -->|reads| World
    VS -->|reads/writes| World

    style World fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style Systems fill:#0f3460,stroke:#16213e,color:#e0e0e0
```

### Entity IDs

```mermaid
graph LR
    subgraph "Branded IDs (compile-time distinct)"
        NID["NodeEntityId
        number & { __brand: 'NodeEntityId' }"]
        LID["LinkEntityId
        number & { __brand: 'LinkEntityId' }"]
        SID["SubgraphEntityId
        string & { __brand: 'SubgraphEntityId' }"]
        WID["WidgetEntityId
        number & { __brand: 'WidgetEntityId' }"]
        SLID["SlotEntityId
        number & { __brand: 'SlotEntityId' }"]
        RID["RerouteEntityId
        number & { __brand: 'RerouteEntityId' }"]
        GID["GroupEntityId
        number & { __brand: 'GroupEntityId' }"]
    end

    NID -.-x LID
    LID -.-x WID
    WID -.-x SLID

    linkStyle 0 stroke:red,stroke-dasharray:5
    linkStyle 1 stroke:red,stroke-dasharray:5
    linkStyle 2 stroke:red,stroke-dasharray:5
```

Red dashed lines = compile-time errors if mixed. No more accidentally passing a `LinkId` where a `NodeId` is expected.

## 2. Component Composition

### Node: Before vs After

```mermaid
graph LR
    subgraph Before["LGraphNode (monolith)"]
        direction TB
        B1["pos, size, bounding"]
        B2["color, bgcolor, title"]
        B3["type, category, nodeData"]
        B4["inputs[], outputs[]"]
        B5["order, mode, flags"]
        B6["properties, properties_info"]
        B7["widgets[]"]
        B8["serialize(), configure()"]
        B9["drawSlots(), drawWidgets()"]
        B10["execute(), triggerSlot()"]
        B11["graph._version++"]
        B12["connect(), disconnect()"]
    end

    subgraph After["NodeEntityId + Components"]
        direction TB
        A1["Position
        { pos, size, bounding }"]
        A2["NodeVisual
        { color, bgcolor, boxcolor, title }"]
        A3["NodeType
        { type, category, nodeData }"]
        A4["Connectivity
        { inputSlotIds[], outputSlotIds[] }"]
        A5["Execution
        { order, mode, flags }"]
        A6["Properties
        { properties, propertiesInfo }"]
        A7["WidgetContainer
        { widgetIds[] }"]
    end

    B1 -.-> A1
    B2 -.-> A2
    B3 -.-> A3
    B4 -.-> A4
    B5 -.-> A5
    B6 -.-> A6
    B7 -.-> A7

    B8 -.->|"moves to"| SYS1["SerializationSystem"]
    B9 -.->|"moves to"| SYS2["RenderSystem"]
    B10 -.->|"moves to"| SYS3["ExecutionSystem"]
    B11 -.->|"moves to"| SYS4["VersionSystem"]
    B12 -.->|"moves to"| SYS5["ConnectivitySystem"]

    style Before fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style After fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
```

### Link: Before vs After

```mermaid
graph LR
    subgraph Before["LLink (class)"]
        direction TB
        B1["origin_id, origin_slot
        target_id, target_slot, type"]
        B2["color, path, _pos"]
        B3["_dragging, data"]
        B4["disconnect()"]
        B5["resolve()"]
    end

    subgraph After["LinkEntityId + Components"]
        direction TB
        A1["LinkEndpoints
        { originId, originSlot,
        targetId, targetSlot, type }"]
        A2["LinkVisual
        { color, path, centerPos }"]
        A3["LinkState
        { dragging, data }"]
    end

    B1 -.-> A1
    B2 -.-> A2
    B3 -.-> A3
    B4 -.->|"moves to"| SYS1["ConnectivitySystem"]
    B5 -.->|"moves to"| SYS2["ConnectivitySystem"]

    style Before fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style After fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
```

### Widget: Before vs After

```mermaid
graph LR
    subgraph Before["BaseWidget (class)"]
        direction TB
        B1["name, type, _node"]
        B2["value, options, serialize"]
        B3["computedHeight, margin"]
        B4["drawWidget(), onClick()"]
        B5["useWidgetValueStore()"]
        B6["usePromotionStore()"]
    end

    subgraph After["WidgetEntityId + Components"]
        direction TB
        A1["WidgetIdentity
        { name, widgetType, parentNodeId }"]
        A2["WidgetValue
        { value, options, serialize }"]
        A3["WidgetLayout
        { computedHeight, constraints }"]
    end

    B1 -.-> A1
    B2 -.-> A2
    B3 -.-> A3
    B4 -.->|"moves to"| SYS1["RenderSystem"]
    B5 -.->|"absorbed by"| SYS2["World (is the store)"]
    B6 -.->|"moves to"| SYS3["PromotionSystem"]

    style Before fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style After fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
```

## 3. System Architecture

Systems are pure functions that query the World for entities with specific component combinations. Each system owns exactly one concern.

```mermaid
graph TD
    subgraph InputPhase["Input Phase"]
        UserInput["User Input
        (pointer, keyboard)"]
        APIInput["API Input
        (backend execution results)"]
    end

    subgraph UpdatePhase["Update Phase (ordered)"]
        direction TB
        CS["ConnectivitySystem
        Manages link/slot mutations.
        Writes: LinkEndpoints, SlotConnection,
        Connectivity"]
        VS["VersionSystem
        Centralizes change tracking.
        Replaces 15+ scattered _version++.
        Writes: version counter"]
        LS["LayoutSystem
        Computes positions and sizes.
        Runs BEFORE render, not during.
        Reads: Connectivity, WidgetContainer
        Writes: Position, SlotVisual, WidgetLayout"]
        ES["ExecutionSystem
        Determines run order.
        Reads: Connectivity, Execution
        Writes: Execution.order"]
    end

    subgraph RenderPhase["Render Phase (read-only)"]
        RS["RenderSystem
        Pure read of components.
        No state mutation.
        Reads: Position, *Visual, *Layout"]
    end

    subgraph PersistPhase["Persist Phase"]
        SS["SerializationSystem
        Reads/writes all components.
        Handles workflow JSON."]
    end

    UserInput --> CS
    APIInput --> ES
    CS --> VS
    VS --> LS
    LS --> RS
    CS --> SS

    style InputPhase fill:#2a2a4a,stroke:#3a3a5a,color:#e0e0e0
    style UpdatePhase fill:#1a3a2a,stroke:#2a4a3a,color:#e0e0e0
    style RenderPhase fill:#3a2a1a,stroke:#4a3a2a,color:#e0e0e0
    style PersistPhase fill:#2a2a3a,stroke:#3a3a4a,color:#e0e0e0
```

### System-Component Access Matrix

```mermaid
graph LR
    subgraph Systems
        RS["Render"]
        SS["Serialization"]
        CS["Connectivity"]
        LS["Layout"]
        ES["Execution"]
        VS["Version"]
    end

    subgraph Components
        Pos["Position"]
        NV["NodeVisual"]
        NT["NodeType"]
        Con["Connectivity"]
        Exe["Execution"]
        Props["Properties"]
        WC["WidgetContainer"]
        LE["LinkEndpoints"]
        LV["LinkVisual"]
        SC["SlotConnection"]
        SV["SlotVisual"]
        WVal["WidgetValue"]
        WL["WidgetLayout"]
    end

    RS -.->|read| Pos
    RS -.->|read| NV
    RS -.->|read| LV
    RS -.->|read| SV
    RS -.->|read| WL

    LS -->|write| Pos
    LS -->|write| SV
    LS -->|write| WL
    LS -.->|read| Con
    LS -.->|read| WC

    CS -->|write| LE
    CS -->|write| SC
    CS -->|write| Con

    ES -.->|read| Con
    ES -->|write| Exe

    SS -.->|read/write| Pos
    SS -.->|read/write| NT
    SS -.->|read/write| Props
    SS -.->|read/write| WVal
    SS -.->|read/write| LE

    VS -.->|read| Pos
    VS -.->|read| Con
```

## 4. Dependency Flow

### Before: Tangled References

```mermaid
graph TD
    Node["LGraphNode"] <-->|"circular"| Graph["LGraph"]
    Graph <-->|"circular"| Subgraph["Subgraph"]
    Node -->|"this.graph._links"| Links["LLink Map"]
    Node -->|"this.graph.getNodeById"| Node
    Canvas["LGraphCanvas"] -->|"node.graph._version++"| Graph
    Canvas -->|"node.graph.remove(node)"| Graph
    Widget["BaseWidget"] -->|"useWidgetValueStore()"| Store1["Pinia Store"]
    Widget -->|"usePromotionStore()"| Store2["Pinia Store"]
    Node -->|"useLayoutMutations()"| Store3["Layout Store"]
    Graph -->|"useLayoutMutations()"| Store3
    LLink["LLink"] -->|"useLayoutMutations()"| Store3

    style Node fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style Graph fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style Canvas fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style Widget fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
```

### After: Unidirectional Data Flow

```mermaid
graph TD
    subgraph Systems["Systems"]
        RS["RenderSystem"]
        CS["ConnectivitySystem"]
        LS["LayoutSystem"]
        ES["ExecutionSystem"]
        SS["SerializationSystem"]
        VS["VersionSystem"]
    end

    World["World
    (single source of truth)"]

    subgraph Components["Component Stores"]
        Pos["Position"]
        Vis["*Visual"]
        Con["Connectivity"]
        Val["*Value"]
    end

    Systems -->|"query/mutate"| World
    World -->|"contains"| Components

    style Systems fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
    style World fill:#1a1a4a,stroke:#2a2a6a,color:#e0e0e0
    style Components fill:#1a3a3a,stroke:#2a4a4a,color:#e0e0e0
```

Key differences:

- **No circular dependencies**: entities are IDs, not class instances
- **No Demeter violations**: systems query the World directly, never reach through entities
- **No scattered store access**: the World _is_ the store; systems are the only writers
- **Unidirectional**: Input → Systems → World → Render (no back-edges)

## 5. Problem Resolution Map

How each problem from [entity-problems.md](entity-problems.md) is resolved:

```mermaid
graph LR
    subgraph Problems["Current Problems"]
        P1["God Objects
        (9k+ line classes)"]
        P2["Circular Deps
        (LGraph ↔ Subgraph)"]
        P3["Mixed Concerns
        (render + domain + state)"]
        P4["Inconsistent IDs
        (number|string, no safety)"]
        P5["Demeter Violations
        (graph._links, graph._version++)"]
        P6["Scattered Side Effects
        (15+ _version++ sites)"]
        P7["Render-Time Mutations
        (arrange() during draw)"]
    end

    subgraph Solutions["ECS Solutions"]
        S1["Components: small, focused
        data objects (5-10 fields each)"]
        S2["Entities are just IDs.
        No inheritance hierarchy."]
        S3["One system per concern.
        Systems don't overlap."]
        S4["Branded per-kind IDs.
        Compile-time type errors."]
        S5["Systems query World.
        No entity→entity refs."]
        S6["VersionSystem owns
        all change tracking."]
        S7["LayoutSystem runs in
        update phase, before render.
        RenderSystem is read-only."]
    end

    P1 --> S1
    P2 --> S2
    P3 --> S3
    P4 --> S4
    P5 --> S5
    P6 --> S6
    P7 --> S7

    style Problems fill:#4a1a1a,stroke:#6a2a2a,color:#e0e0e0
    style Solutions fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
```

## 6. Migration Bridge

The migration is incremental. During the transition, a bridge layer keeps legacy class properties and ECS components in sync.

```mermaid
sequenceDiagram
    participant Legacy as Legacy Code
    participant Class as LGraphNode (class)
    participant Bridge as Bridge Adapter
    participant World as World (ECS)
    participant New as New Code / Systems

    Note over Legacy,New: Phase 1: Bridge reads from class, writes to World

    Legacy->>Class: node.pos = [100, 200]
    Class->>Bridge: pos setter intercepted
    Bridge->>World: world.setComponent(nodeId, Position, { pos: [100, 200] })

    New->>World: world.getComponent(nodeId, Position)
    World-->>New: { pos: [100, 200], size: [...] }

    Note over Legacy,New: Phase 2: New features build on ECS directly

    New->>World: world.setComponent(nodeId, Position, { pos: [150, 250] })
    World->>Bridge: change detected
    Bridge->>Class: node._pos = [150, 250]
    Legacy->>Class: node.pos
    Class-->>Legacy: [150, 250]

    Note over Legacy,New: Phase 3: Legacy code migrated, bridge removed

    New->>World: world.getComponent(nodeId, Position)
    World-->>New: { pos: [150, 250] }
```

### Migration Phases

```mermaid
graph LR
    subgraph Phase1["Phase 1: Types Only"]
        T1["Define branded IDs"]
        T2["Define component interfaces"]
        T3["Define World type"]
    end

    subgraph Phase2["Phase 2: Bridge"]
        B1["Bridge adapters
        class ↔ World sync"]
        B2["New features use
        World as source"]
        B3["Old code unchanged"]
    end

    subgraph Phase3["Phase 3: Extract"]
        E1["Migrate one component
        at a time"]
        E2["Deprecate class
        properties"]
        E3["Systems replace
        methods"]
    end

    subgraph Phase4["Phase 4: Clean"]
        C1["Remove bridge"]
        C2["Remove legacy classes"]
        C3["Systems are sole
        behavior layer"]
    end

    Phase1 --> Phase2 --> Phase3 --> Phase4

    style Phase1 fill:#1a2a4a,stroke:#2a3a5a,color:#e0e0e0
    style Phase2 fill:#1a3a3a,stroke:#2a4a4a,color:#e0e0e0
    style Phase3 fill:#2a3a1a,stroke:#3a4a2a,color:#e0e0e0
    style Phase4 fill:#1a4a1a,stroke:#2a6a2a,color:#e0e0e0
```
