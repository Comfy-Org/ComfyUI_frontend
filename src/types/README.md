# Reactive Layout Types

This directory contains type definitions for the reactive layout system that enables Vue nodes to handle their own interactions while staying synchronized with LiteGraph.

## Architecture Overview

```mermaid
graph TB
    subgraph "Type Definitions"
        Point[Point: x, y]
        Size[Size: width, height]
        Bounds[Bounds: x, y, width, height]
        SlotRef[SlotRef: nodeId, slotIndex, isOutput]
    end

    subgraph "Core Interfaces"
        LayoutTree[LayoutTree<br/>- nodePositions<br/>- nodeBounds<br/>- selectedNodes]
        HitTester[HitTester<br/>- getNodeAt<br/>- getNodesInBounds]
        GraphMutationService[GraphMutationService<br/>- moveNode<br/>- selectNode<br/>- connectNodes]
        InteractionState[InteractionState<br/>- dragState<br/>- selectionState]
    end

    subgraph "Renderer Interface"
        GraphRenderer[GraphRenderer<br/>- setLayoutTree<br/>- render<br/>- mount/unmount]
    end

    Point --> Bounds
    Size --> Bounds
    Bounds --> LayoutTree
    Bounds --> HitTester
    Point --> GraphMutationService
    SlotRef --> GraphMutationService
    LayoutTree --> GraphRenderer
    HitTester --> GraphRenderer
</mermaid>

## Data Flow During Interactions

```mermaid
sequenceDiagram
    participant User
    participant VueNode
    participant LayoutTree
    participant LiteGraph
    
    User->>VueNode: Drag Start
    VueNode->>VueNode: Apply CSS Transform
    Note over VueNode: Visual feedback only
    
    User->>VueNode: Drag Move
    VueNode->>VueNode: Update CSS Transform
    Note over VueNode: Smooth dragging
    
    User->>VueNode: Drag End
    VueNode->>LayoutTree: updateNodePosition()
    LayoutTree->>LiteGraph: Reactive sync
    LiteGraph->>LiteGraph: Update canvas
```

## Key Interfaces

### LayoutTree
- Manages spatial/visual information reactively
- Provides reactive getters for positions, bounds, and selection
- Allows both Canvas and Vue renderers to update during transition

### HitTester
- Provides spatial queries (find nodes at point, in bounds)
- Offers both reactive (auto-updating) and direct queries
- Integrates with QuadTree spatial indexing for performance

### GraphMutationService
- Future API for all graph data changes
- Separates data mutations from layout updates
- Will be the single point of access for graph modifications

### InteractionState
- Tracks user interactions reactively
- Manages drag and selection state
- Provides actions for state transitions
</mermaid>