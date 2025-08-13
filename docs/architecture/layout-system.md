# Layout System Architecture

## Overview

The Layout System provides a single source of truth for node positions, sizes, and spatial data in the ComfyUI frontend. It uses CRDT (Conflict-free Replicated Data Types) via Yjs to eliminate snap-back issues and ownership conflicts between LiteGraph and Vue components.

## Architecture

```
┌─────────────────────┐     ┌────────────────────┐
│   Layout Store      │────▶│  LiteGraph Canvas  │
│   (CRDT/Yjs)       │     │    (One-way sync)  │
└────────┬────────────┘     └────────────────────┘
         │
         │  Mutations API
         │
┌────────▼────────────┐
│   Vue Components    │
│  (Read + Mutate)    │
└─────────────────────┘
```

## Key Components

### 1. Layout Store (`/src/stores/layoutStore.ts`)
- **Yjs-based CRDT implementation** for conflict-free operations
- **Single source of truth** for all layout data
- **Reactive state** with Vue `customRef` for shared write access
- **Spatial queries** - find nodes at point or in bounds
- **Operation history** - tracks all changes with actor/source

### 2. Layout Mutations (`/src/services/layoutMutations.ts`)
- **Clean API** for modifying layout state
- **Source tracking** - identifies where changes originated (canvas/vue/external)
- **Direct operations** - no queuing, CRDT handles consistency

### 3. Vue Integration (`/src/composables/graph/useLayout.ts`)
- **`useLayout()`** - Access store and mutations
- **`useNodeLayout(nodeId)`** - Per-node reactive data and drag handlers
- **`useLayoutSync()`** - One-way sync from Layout to LiteGraph

## Usage Examples

### Basic Node Access
```typescript
const { store, mutations } = useLayout()

// Get reactive node layout
const nodeRef = store.getNodeLayoutRef('node-123')
const position = computed(() => nodeRef.value?.position ?? { x: 0, y: 0 })
```

### Vue Component Integration
```vue
<script setup>
const {
  position,
  nodeStyle,
  startDrag,
  handleDrag,
  endDrag
} = useNodeLayout(props.nodeId)
</script>

<template>
  <div
    :style="nodeStyle"
    @pointerdown="startDrag"
    @pointermove="handleDrag"
    @pointerup="endDrag"
  >
    <!-- Node content -->
  </div>
</template>
```

## Performance Optimizations

### 1. **Spatial Query Caching**
- Cache for `queryNodesInBounds` results
- Cleared on any mutation for consistency

### 2. **Direct Transform Updates**
- CSS `transform: translate()` for GPU acceleration
- No layout recalculation during dragging
- Smooth 60fps performance

### 3. **CSS Containment**
- `contain: layout style paint` on nodes
- Isolates rendering for better performance

### 4. **One-Way Data Flow**
- Layout → LiteGraph only
- Prevents circular updates and conflicts
- Source tracking avoids sync loops

## CRDT Benefits

Using Yjs even for single-user mode provides:
- **Zero race conditions** between Vue and Canvas updates
- **Built-in operation tracking** for debugging
- **Future-proof** - ready for real-time collaboration
- **Minimal overhead** - Yjs is optimized for local operations

## Node Stacking/Z-Index

Based on LiteGraph's implementation:
- Nodes are rendered in array order (later = on top)
- Clicking a node brings it to front via `bringToFront()`
- Z-index in layout store tracks rendering order
- TODO: Implement interaction-based stacking

## API Reference

### LayoutStore Methods
- `getNodeLayoutRef(nodeId)` - Get reactive node layout
- `getAllNodes()` - Get all nodes as reactive Map
- `getNodesInBounds(bounds)` - Reactive spatial query
- `queryNodeAtPoint(point)` - Non-reactive point query
- `queryNodesInBounds(bounds)` - Non-reactive bounds query
- `initializeFromLiteGraph(nodes)` - Initialize from existing graph

### LayoutMutations Methods
- `moveNode(nodeId, position)` - Update node position
- `resizeNode(nodeId, size)` - Update node size
- `setNodeZIndex(nodeId, zIndex)` - Update rendering order
- `createNode(nodeId, layout)` - Add new node
- `deleteNode(nodeId)` - Remove node
- `setSource(source)` - Set mutation source
- `setActor(actor)` - Set actor for CRDT

## Future Enhancements

- [ ] Interaction-based z-index updates
- [ ] QuadTree integration for O(log n) spatial queries
- [ ] Undo/redo via operation history
- [ ] Real-time collaboration via Yjs network adapters
- [ ] Performance metrics collection

## Debug Mode

Enable debug logging in development or via console:
```javascript
localStorage.setItem('layout-debug', 'true')
location.reload()
```