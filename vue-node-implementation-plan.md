# Vue Node Component Implementation Plan

## Overview

This plan outlines the implementation of Vue node components that will integrate with the existing LiteGraph system. These components are designed to work within a future transform/sync system while focusing purely on the component architecture.

## Core Components

### 1. **LGraphNode.vue** - Main Node Container
- Receives LGraphNode as prop
- Renders node layout: header, slots, widgets, content
- Positioned absolutely using node.pos
- CSS containment for performance
- Integrates all sub-components

### 2. **NodeHeader.vue** - Node Title & Controls  
- Node title display
- Collapse/expand button
- Node color/styling based on type
- Designed for future drag handle integration

### 3. **NodeSlots.vue** - Connection Points Container
- Renders input/output slot visual indicators
- Shows slot names and types
- Visual-only - LiteGraph handles actual connections
- Contains InputSlot and OutputSlot sub-components
- Handles slot layout (vertical/horizontal)

#### 3.1 **InputSlot.vue** - Input Connection Point
- Visual representation of input slots
- Shows connection state
- Click events for future connection logic
- Type-based color coding (mirrors LiteGraph's slot_default_color_by_type)
- Connection dot positioning
- Hover states for connection compatibility

#### 3.2 **OutputSlot.vue** - Output Connection Point
- Visual representation of output slots
- Shows connection state
- Click events for future connection logic
- Type-based color coding (mirrors LiteGraph's slot_default_color_by_type)
- Multiple connection support visualization
- Hover states for connection compatibility

### 4. **NodeWidgets.vue** - Widget Container
- Integrates with existing widget system
- Maps LGraphNode.widgets to Vue widget components
- Uses widget registry for dynamic rendering
- Handles widget layout within node

### 5. **NodeContent.vue** - Custom Content Area
- Extensible area for node-specific content
- Slot-based for future customization
- Allows for specialized node types

### 6. **Node Registry System**
- Maps LGraphNode types to Vue components
- Similar pattern to widget registry
- Enables dynamic node component rendering
- Type-safe component resolution

## Directory Structure

```
src/components/graph/vueNodes/
├── LGraphNode.vue             # Main node component
├── NodeHeader.vue             # Title/controls
├── NodeSlots.vue              # Connection points container
│   ├── InputSlot.vue          # Individual input slot
│   └── OutputSlot.vue         # Individual output slot  
├── NodeWidgets.vue            # Widget integration
├── NodeContent.vue            # Custom content area
├── nodeRegistry.ts            # Node type registry
└── index.ts                   # Component exports
```

## Key Design Decisions

1. **Use Existing LGraphNode Interface** - No new interfaces needed, work with existing LiteGraph node structure
2. **Pure Component Design** - Components receive LGraphNode as props, emit events up
3. **Widget System Integration** - NodeWidgets.vue leverages existing widget registry
4. **Visual-Only Slots** - Connection logic stays in LiteGraph entirely
5. **Transform-Ready** - Designed to work with absolute positioning in future transform container
6. **Registry Pattern** - Consistent with widget system for dynamic rendering

## Component Props Pattern

Each component follows a consistent prop pattern:

```typescript
// Base props for all node components
interface BaseNodeProps {
  node: LGraphNode
  readonly?: boolean
}

// Extended props for main node component
interface LGraphNodeProps extends BaseNodeProps {
  selected?: boolean          // Selection state from graph
  executing?: boolean         // Execution state
  progress?: number          // Execution progress (0-1)
  error?: string | null      // Error state message
  zoomLevel?: number         // For LOD calculations
}

// Props for slot components
interface SlotProps extends BaseNodeProps {
  slot: INodeSlot
  index: number
  type: 'input' | 'output'
  connected?: boolean        // Has active connection
  compatible?: boolean       // For hover states during dragging
}

// Usage
defineProps<LGraphNodeProps>()
```

## Error Handling Pattern

Each component should implement error boundaries for graceful failure:

```vue
<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Render Error
  </div>
  <div v-else>
    <!-- Normal component content -->
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node component error:', error)
  return false // Prevent error propagation
})
</script>
```

This ensures that if any node component encounters an error, it fails gracefully without breaking the entire graph.

## Performance Optimization with v-memo

Vue's `v-memo` directive can prevent unnecessary re-renders by memoizing template sections. This is particularly valuable for nodes with many widgets or during graph manipulation.

### Simple Implementation

Start with basic memoization on the most expensive parts:

```vue
<!-- In LGraphNode.vue -->
<template>
  <div class="vue-node">
    <!-- Memoize widgets - only re-render when count or values change -->
    <NodeWidgets 
      v-memo="[node.widgets?.length, ...node.widgets?.map(w => w.value) ?? []]"
      :node="node"
    />
  </div>
</template>
```

### Long-term Implementation

As the system scales, add more granular memoization:

```vue
<template>
  <div class="vue-node">
    <!-- Header only updates on title/color changes -->
    <NodeHeader 
      v-memo="[node.title, node.color]"
      :node="node" 
    />
    
    <!-- Slots only update when connections change -->
    <NodeSlots 
      v-memo="[node.inputs?.length, node.outputs?.length]"
      :node="node"
    />
    
    <!-- Widgets update on value changes -->
    <NodeWidgets 
      v-memo="[node.widgets?.length, ...node.widgets?.map(w => w.value) ?? []]"
      :node="node"
    />
  </div>
</template>
```

### Pros
- Prevents widget re-renders during node dragging (position changes don't affect content)
- Scales better with 100+ nodes containing multiple widgets
- Significantly reduces render time for complex node graphs

### Cons
- May miss updates if LiteGraph mutates objects in-place
- Adds memory overhead from cached VDOM
- Can make debugging harder ("why isn't my node updating?")

### Recommendation
Start without v-memo, then add it selectively after profiling identifies performance bottlenecks. The widgets container is the most likely candidate for optimization since widgets are the most complex child components.

## Implementation Strategy

### Phase 1: Core Structure
1. Create LGraphNode.vue base component with layout structure
2. Implement NodeHeader.vue with basic title/controls
3. Build NodeSlots.vue container with visual slot rendering

### Phase 2: Widget Integration
4. Implement NodeWidgets.vue to integrate with existing widget system
5. Create NodeContent.vue for extensibility

### Phase 3: Registry System
6. Build node registry for dynamic component resolution
7. Add index.ts exports

## Visual State Management

Node components will use Tailwind classes dynamically based on state:

```vue
<!-- In LGraphNode.vue -->
<template>
  <div :class="[
    'absolute border-2 rounded bg-surface-0',
    selected ? 'border-primary-500 ring-2 ring-primary-300' : 'border-surface-300',
    executing ? 'animate-pulse' : '',
    node.mode === 4 ? 'opacity-50' : '', // bypassed
    error ? 'border-red-500 bg-red-50' : ''
  ]">
    <!-- Node content -->
  </div>
</template>
```

Visual states to support:
- **Selected**: Border color change and ring effect
- **Executing**: Pulse animation
- **Bypassed**: Reduced opacity
- **Error**: Red border and background tint
- **Collapsed**: Height reduction (handled by v-if on body content)

## CSS Performance Strategy

Nodes will use CSS containment for optimal performance:

```css
.lg-node {
  position: absolute;
  contain: layout style paint;
  /* will-change only added during drag via class */
}

.lg-node--dragging {
  will-change: transform;
}
```

Key performance considerations:
- Position absolutely within transform pane (no individual transforms)
- CSS containment prevents layout thrashing
- GPU acceleration only during drag operations
- No complex calculations in Vue components

## Design Principles

- **Separation of Concerns**: Each component handles one aspect of node rendering
- **LiteGraph Integration**: Components designed to work with existing LiteGraph data structures
- **Performance First**: CSS containment, efficient rendering patterns
- **Future-Ready**: Architecture supports transform container and event delegation
- **Consistent Patterns**: Follows same patterns as widget system implementation
- **Tailwind-First**: Use utility classes for all styling, no custom CSS

## Expected Outcomes

- Clean, modular Vue components for node rendering
- Seamless integration with existing widget system
- Foundation ready for transform/sync layer implementation
- Maintainable and extensible architecture