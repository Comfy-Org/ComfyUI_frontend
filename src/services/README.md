# Reactive Layout Services

This directory contains the core implementations of the reactive layout system that bridges Vue node interactions with LiteGraph.

## Service Architecture

```mermaid
graph LR
    subgraph "Services"
        RLT[ReactiveLayoutTree<br/>- Position/Bounds State<br/>- Selection State]
        RHT[ReactiveHitTester<br/>- Spatial Queries<br/>- QuadTree Integration]
    end

    subgraph "Renderers"
        Canvas[Canvas Renderer<br/>(LiteGraph)]
        Vue[Vue Renderer<br/>(DOM Nodes)]
    end

    subgraph "Spatial Index"
        QT[QuadTree<br/>Spatial Index]
    end

    Canvas -->|Write| RLT
    Vue -->|Write| RLT
    RLT -->|Reactive Updates| Canvas
    RLT -->|Reactive Updates| Vue
    
    RHT -->|Query| QT
    RLT -->|Sync Bounds| RHT
    RHT -->|Hit Testing| Vue
</mermaid>

## ReactiveLayoutTree Implementation

```mermaid
classDiagram
    class ReactiveLayoutTree {
        -_nodePositions: Ref~Map~
        -_nodeBounds: Ref~Map~
        -_selectedNodes: Ref~Set~
        +nodePositions: ComputedRef~Map~
        +nodeBounds: ComputedRef~Map~
        +selectedNodes: Ref~Set~
        +updateNodePosition(nodeId, position)
        +updateNodeBounds(nodeId, bounds)
        +selectNodes(nodeIds, addToSelection)
        +clearSelection()
    }

    class customRef {
        <<Vue Reactivity>>
        +track()
        +trigger()
    }

    ReactiveLayoutTree --> customRef : uses for shared write access
```

### Key Features
- Uses Vue's `customRef` to allow both renderers to write
- Provides reactive computed properties for automatic updates
- Maintains immutable update pattern (creates new Maps on change)
- Supports both single and bulk updates

## ReactiveHitTester Implementation

```mermaid
flowchart TB
    subgraph "Hit Testing Flow"
        Query[Spatial Query]
        QT[QuadTree Index]
        Candidates[Candidate Nodes]
        Precise[Precise Bounds Check]
        Result[Hit Test Result]
    end

    Query -->|Viewport Bounds| QT
    QT -->|Fast Filter| Candidates
    Candidates -->|Intersection Test| Precise
    Precise --> Result

    subgraph "Reactive Queries"
        RP[Reactive Point Query]
        RB[Reactive Bounds Query]
        Auto[Auto-update on Layout Change]
    end

    RP --> Query
    RB --> Query
    Auto -.->|Triggers| RP
    Auto -.->|Triggers| RB
```

### Performance Optimizations
- Integrates with existing QuadTree spatial indexing
- Two-phase hit testing: spatial index filter + precise bounds check
- Reactive queries use Vue's computed for efficient caching
- Direct queries available for immediate results during interactions

## Data Synchronization

```mermaid
sequenceDiagram
    participant LG as LiteGraph
    participant LT as LayoutTree
    participant HT as HitTester
    participant SI as Spatial Index
    participant VN as Vue Node

    Note over LG,VN: Initial Sync
    LG->>LT: Bulk position update
    LT->>HT: Bounds changed (reactive)
    HT->>SI: Batch update spatial index

    Note over LG,VN: Vue Node Drag
    VN->>VN: CSS transform (visual)
    VN->>LT: updateNodePosition (on drag end)
    LT->>LG: Position changed (reactive watch)
    LT->>HT: Bounds changed (reactive)
    HT->>SI: Update node in index
    LG->>LG: Redraw canvas

    Note over LG,VN: Canvas Drag
    LG->>LG: Update node.pos
    LG->>LT: Sync position (RAF)
    LT->>HT: Bounds changed (reactive)
    HT->>SI: Update node in index
    LT->>VN: Position changed (reactive)
```

## Usage Example

```typescript
// In Vue component
const { layoutTree, hitTester } = useReactiveLayout()

// Initialize layout tree sync
const { initializeSync } = useLiteGraphSync()
initializeSync()

// In Vue node component
const { 
  isDragging,
  startDrag,
  handleDrag,
  endDrag,
  dragStyle 
} = useVueNodeInteraction(nodeId)

// Reactive position tracking
const nodePos = hitTester.getNodePosition(nodeId)
watch(nodePos, (newPos) => {
  console.log('Node moved to:', newPos)
})
```