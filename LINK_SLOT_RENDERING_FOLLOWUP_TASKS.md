# Link/Slot Rendering Followup Tasks

## Overview

After merging PR #5134, we need to implement several improvements to make the link/slot rendering decoupling production-ready. This document outlines our followup implementation tasks with technical details and code examples.

## Critical Fixes to Implement

### Task 1: Fix memory leaks in node deletion

**File**: `src/renderer/core/layout/store/LayoutStore.ts`
**Location**: `handleDeleteNode` method (~Line 150-170)

**Problem**: When nodes are deleted, associated slots remain in spatial indexes causing memory leaks and false positive hit detection.

**Implementation**:
```typescript
handleDeleteNode(nodeId: string) {
  // Current code only deletes node
  this.ynodes.delete(nodeId)
  
  // TODO: Add slot cleanup
  const nodeSlots = this.slotSpatialIndex.query(/* node bounds */)
  nodeSlots.forEach(slot => {
    if (slot.nodeId === nodeId) {
      this.slotSpatialIndex.remove(slot)
      this.yslots.delete(slot.id)
    }
  })
  
  // TODO: Also clean up associated links
  const nodeLinks = this.linkSpatialIndex.query(/* node bounds */)
  nodeLinks.forEach(link => {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      this.linkSpatialIndex.remove(link)
      this.ylinks.delete(link.id)
    }
  })
}
```

### Task 2: Fix race conditions in spatial index updates

**File**: `src/renderer/core/layout/store/LayoutStore.ts`
**Location**: `moveNode` and other mutation methods (~Line 200-220)

**Problem**: Hit detection queries can run before spatial index updates complete, causing failures.

**Implementation**:
```typescript
// TODO: Replace current async pattern with synchronous updates
moveNode(nodeId: string, position: [number, number]) {
  const oldData = this.ynodes.get(nodeId)
  const newData = { ...oldData, pos: position }
  
  // TODO: Update spatial index FIRST, synchronously
  if (oldData) this.nodeSpatialIndex.remove(oldData)
  this.nodeSpatialIndex.insert(newData)
  
  // TODO: Update associated slots synchronously
  this.updateNodeSlotPositions(nodeId, position)
  
  // Then update CRDT
  this.ynodes.set(nodeId, newData)
}

// TODO: Add helper method for slot position updates
private updateNodeSlotPositions(nodeId: string, nodePosition: [number, number]) {
  const slots = this.getSlotsByNodeId(nodeId)
  slots.forEach(slot => {
    const oldSlot = this.yslots.get(slot.id)
    const newSlot = { ...oldSlot, pos: this.calculateSlotPosition(slot, nodePosition) }
    
    this.slotSpatialIndex.remove(oldSlot)
    this.slotSpatialIndex.insert(newSlot)
    this.yslots.set(slot.id, newSlot)
  })
}
```

### Task 3: Add Yjs observer lifecycle management

**File**: `src/renderer/core/layout/store/LayoutStore.ts`
**Location**: Constructor and throughout class (~Line 80-100)

**Problem**: Yjs observers are not properly cleaned up, causing memory leaks.

**Implementation**:
```typescript
export class LayoutStore {
  // TODO: Track all observers for cleanup
  private observers = new Set<() => void>()
  
  constructor() {
    // TODO: Wrap all observer registrations
    const unsubscribeNodes = this.ynodes.observe(this.onNodesChange.bind(this))
    const unsubscribeLinks = this.ylinks.observe(this.onLinksChange.bind(this))
    const unsubscribeSlots = this.yslots.observe(this.onSlotsChange.bind(this))
    
    this.observers.add(unsubscribeNodes)
    this.observers.add(unsubscribeLinks)
    this.observers.add(unsubscribeSlots)
  }
  
  // TODO: Add cleanup method
  dispose() {
    this.observers.forEach(unsubscribe => unsubscribe())
    this.observers.clear()
    this.spatialIndex.clear()
  }
}

// TODO: Update composables to use lifecycle hooks
// File: src/renderer/extensions/vueNodes/layout/useNodeLayout.ts
export function useLayoutStore() {
  const store = getLayoutStore()
  
  onUnmounted(() => {
    // TODO: Call store cleanup when component unmounts
    if (store.dispose) {
      store.dispose()
    }
  })
  
  return store
}
```

### Task 4: Add spatial index integrity validation

**File**: `src/renderer/core/layout/store/LayoutStore.ts`
**Location**: Add new methods (~Line 300-350)

**Problem**: Spatial index can become corrupted during batch operations without detection.

**Implementation**:
```typescript
// TODO: Add integrity validation
validateSpatialIndexIntegrity(): boolean {
  const allNodes = Array.from(this.ynodes.values())
  const indexedNodes = this.nodeSpatialIndex.getAllItems()
  
  if (allNodes.length !== indexedNodes.length) {
    console.error('Node spatial index corruption detected', {
      crdt: allNodes.length,
      spatial: indexedNodes.length
    })
    this.rebuildSpatialIndexes()
    return false
  }
  
  // TODO: Validate slots and links too
  const allSlots = Array.from(this.yslots.values())
  const indexedSlots = this.slotSpatialIndex.getAllItems()
  
  if (allSlots.length !== indexedSlots.length) {
    console.error('Slot spatial index corruption detected')
    this.rebuildSpatialIndexes()
    return false
  }
  
  return true
}

// TODO: Add rebuild capability
private rebuildSpatialIndexes() {
  console.info('Rebuilding spatial indexes...')
  
  this.nodeSpatialIndex.clear()
  this.slotSpatialIndex.clear()
  this.linkSpatialIndex.clear()
  
  // Rebuild from CRDT data
  this.ynodes.forEach(node => this.nodeSpatialIndex.insert(node))
  this.yslots.forEach(slot => this.slotSpatialIndex.insert(slot))
  this.ylinks.forEach(link => this.linkSpatialIndex.insert(link))
  
  console.info('Spatial indexes rebuilt successfully')
}

// TODO: Add periodic validation in development
private setupPeriodicValidation() {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      if (!this.validateSpatialIndexIntegrity()) {
        console.warn('Spatial index corruption detected during periodic check')
      }
    }, 5000) // Every 5 seconds in dev
  }
}
```

## High Priority Improvements

### Task 5: Fix coordinate system confusion

**File**: `src/renderer/core/canvas/litegraph/SlotCalculations.ts`
**Location**: All calculation functions (~Line 45-65)

**Problem**: Functions return ambiguous coordinate types mixing canvas and screen coordinates.

**Implementation**:
```typescript
// TODO: Add explicit coordinate system interface
interface CoordinateTransform {
  canvasToScreen(point: [number, number]): [number, number]
  screenToCanvas(point: [number, number]): [number, number]
  scale: number
  offset: [number, number]
}

// TODO: Update all calculation functions to return both coordinate systems
calculateInputSlotPos(
  context: SlotPositionContext, 
  slotIndex: number,
  transform: CoordinateTransform
): { canvas: [number, number], screen: [number, number] } {
  const canvasPos: [number, number] = [
    context.pos[0] + SLOT_CONFIG.OFFSET_FROM_EDGE, 
    context.pos[1] + (slotIndex * SLOT_CONFIG.SPACING)
  ]
  const screenPos = transform.canvasToScreen(canvasPos)
  
  return { canvas: canvasPos, screen: screenPos }
}

// TODO: Update hit detection to specify coordinate system
querySlotAtPoint(screenPoint: [number, number], transform: CoordinateTransform): SlotData | null {
  const canvasPoint = transform.screenToCanvas(screenPoint)
  return this.slotSpatialIndex.query(canvasPoint)
}
```

### Task 6: Replace magic numbers with documented constants

**File**: `src/renderer/core/canvas/litegraph/SlotCalculations.ts`
**Location**: Throughout file (~Line 20-30)

**Implementation**:
```typescript
// TODO: Replace all magic numbers with documented constants
export const SLOT_CONFIG = {
  HEIGHT: 15,           // Height of slot connection area in pixels
  SPACING: 20,          // Vertical spacing between slots in pixels
  HIT_RADIUS: 10,       // Click tolerance radius for hit detection
  OFFSET_FROM_EDGE: 5,  // Distance from node edge to slot center
  INPUT_SIDE_OFFSET: 0, // X offset for input slots (left side)
  OUTPUT_SIDE_OFFSET: 0 // X offset for output slots (right side)
} as const

export const LINK_CONFIG = {
  HIT_TOLERANCE: 8,     // Pixel tolerance for link hit detection
  MIN_SEGMENT_LENGTH: 20, // Minimum length for link segments
  BEZIER_TENSION: 0.5   // Bezier curve tension for smooth links
} as const

// TODO: Use constants throughout calculations
const slotY = context.pos[1] + (slotIndex * SLOT_CONFIG.SPACING) + SLOT_CONFIG.HEIGHT / 2
const hitRadius = SLOT_CONFIG.HIT_RADIUS
```

### Task 7: Add transaction support for atomic operations

**File**: `src/renderer/extensions/vueNodes/layout/useNodeLayout.ts`
**Location**: Add transaction wrapper (~Line 80-120)

**Implementation**:
```typescript
// TODO: Add transaction support for complex operations
export function useLayoutTransactions() {
  const layoutStore = useLayoutStore()
  
  function transaction<T>(fn: () => T): T {
    return layoutStore.yDoc.transact(() => {
      const result = fn()
      
      // TODO: Validate integrity after transaction
      if (!layoutStore.validateSpatialIndexIntegrity()) {
        throw new Error('Transaction resulted in spatial index corruption')
      }
      
      return result
    })
  }
  
  // TODO: Add batch operations
  function batchNodeUpdates(updates: Array<{ nodeId: string, pos: [number, number] }>) {
    transaction(() => {
      updates.forEach(({ nodeId, pos }) => {
        layoutStore.moveNode(nodeId, pos)
      })
    })
  }
  
  return { transaction, batchNodeUpdates }
}
```

### Task 8: Implement consistent error handling

**Files**: Multiple files throughout the layout system

**Implementation**:
```typescript
// TODO: Create error types
// File: src/renderer/core/layout/errors.ts
export class LayoutError extends Error {
  constructor(
    message: string, 
    public code: string,
    public context?: any
  ) {
    super(message)
    this.name = 'LayoutError'
  }
}

export const LayoutErrorCodes = {
  SPATIAL_INDEX_CORRUPTION: 'SPATIAL_INDEX_CORRUPTION',
  COORDINATE_TRANSFORM_FAILED: 'COORDINATE_TRANSFORM_FAILED',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  SLOT_NOT_FOUND: 'SLOT_NOT_FOUND',
  OBSERVER_CLEANUP_FAILED: 'OBSERVER_CLEANUP_FAILED'
} as const

// TODO: Update all methods to return Results instead of throwing
type Result<T, E = LayoutError> = 
  | { success: true; data: T }
  | { success: false; error: E }

// File: src/renderer/core/layout/store/LayoutStore.ts
updateSlot(slot: SlotData): Result<void, LayoutError> {
  try {
    const oldSlot = this.yslots.get(slot.id)
    if (!oldSlot) {
      return {
        success: false,
        error: new LayoutError('Slot not found', LayoutErrorCodes.SLOT_NOT_FOUND, { slotId: slot.id })
      }
    }
    
    // Update spatial index
    this.slotSpatialIndex.remove(oldSlot)
    this.slotSpatialIndex.insert(slot)
    
    // Update CRDT
    this.yslots.set(slot.id, slot)
    
    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: new LayoutError('Failed to update slot', 'UPDATE_FAILED', { slot, cause: error })
    }
  }
}
```

## Architecture Improvements

### Task 9: Split LayoutStore responsibilities

**Problem**: LayoutStore is doing too many things - CRDT operations, spatial indexing, coordinate transforms.

**Implementation Plan**:
```typescript
// TODO: Create focused services
// File: src/renderer/core/layout/services/SpatialQueryService.ts
export class SpatialQueryService {
  constructor(
    private nodeSpatialIndex: QuadTree<NodeData>,
    private slotSpatialIndex: QuadTree<SlotData>,
    private linkSpatialIndex: QuadTree<LinkData>
  ) {}
  
  queryNodeAtPoint(point: [number, number]): NodeData | null {
    return this.nodeSpatialIndex.query(point)
  }
  
  querySlotAtPoint(point: [number, number]): SlotData | null {
    return this.slotSpatialIndex.query(point)
  }
  
  queryItemsInBounds(bounds: Rectangle): {
    nodes: NodeData[]
    slots: SlotData[]
    links: LinkData[]
  } {
    return {
      nodes: this.nodeSpatialIndex.queryBounds(bounds),
      slots: this.slotSpatialIndex.queryBounds(bounds),
      links: this.linkSpatialIndex.queryBounds(bounds)
    }
  }
}

// File: src/renderer/core/layout/services/CoordinateTransformService.ts
export class CoordinateTransformService {
  constructor(private canvas: LGraphCanvas) {}
  
  canvasToScreen(point: [number, number]): [number, number] {
    return this.canvas.convertCanvasToOffset(point)
  }
  
  screenToCanvas(point: [number, number]): [number, number] {
    return this.canvas.convertOffsetToCanvas(point)
  }
  
  getTransform(): CoordinateTransform {
    return {
      canvasToScreen: this.canvasToScreen.bind(this),
      screenToCanvas: this.screenToCanvas.bind(this),
      scale: this.canvas.ds.scale,
      offset: [this.canvas.ds.offset[0], this.canvas.ds.offset[1]]
    }
  }
}

// TODO: Refactor LayoutStore to use services
export class LayoutStore {
  constructor(
    private spatialQuery: SpatialQueryService,
    private coordinateTransform: CoordinateTransformService
  ) {
    // Only CRDT operations and coordination
  }
}
```

## Testing Implementation

### Task 10: Add comprehensive test coverage

**Files to Create**:
- `tests/unit/renderer/core/layout/LayoutStore.test.ts`
- `tests/unit/renderer/core/canvas/SlotCalculations.test.ts`
- `tests/integration/renderer/vue-litegraph-hit-detection.test.ts`

**Implementation**:
```typescript
// TODO: Create memory management tests
// File: tests/unit/renderer/core/layout/LayoutStore.test.ts
describe('Memory Management', () => {
  it('should clean up slots when node is deleted', () => {
    const store = new LayoutStore()
    const nodeId = 'test-node'
    const slotId = 'test-slot'
    
    // Add node with slot
    store.addNode({ id: nodeId, pos: [100, 100] })
    store.addSlot({ id: slotId, nodeId, pos: [110, 110] })
    
    expect(store.querySlotById(slotId)).toBeTruthy()
    
    // Delete node
    store.deleteNode(nodeId)
    
    // Slot should be cleaned up
    expect(store.querySlotById(slotId)).toBeNull()
  })
  
  it('should not leak Yjs observers on dispose', () => {
    const store = new LayoutStore()
    const initialObserverCount = store.yDoc.observers.size
    
    store.dispose()
    
    expect(store.yDoc.observers.size).toBe(initialObserverCount)
  })
})

// TODO: Create race condition tests
describe('Race Conditions', () => {
  it('should handle rapid node movements without hit detection failures', async () => {
    const store = new LayoutStore()
    const nodeId = 'test-node'
    
    store.addNode({ id: nodeId, pos: [0, 0] })
    
    // Rapidly move node
    const promises = []
    for (let i = 0; i < 100; i++) {
      promises.push(store.moveNode(nodeId, [i, i]))
    }
    
    await Promise.all(promises)
    
    // Hit detection should still work
    const foundNode = store.queryNodeAtPoint([99, 99])
    expect(foundNode?.id).toBe(nodeId)
  })
})

// TODO: Create coordinate system tests
describe('Coordinate Systems', () => {
  it('should correctly transform between canvas and screen coordinates', () => {
    const transform = new CoordinateTransformService(mockCanvas)
    const canvasPoint: [number, number] = [100, 200]
    
    const screenPoint = transform.canvasToScreen(canvasPoint)
    const backToCanvas = transform.screenToCanvas(screenPoint)
    
    expect(backToCanvas).toEqual(canvasPoint)
  })
})
```

## Performance Monitoring

### Task 11: Add performance metrics and monitoring

**File**: `src/renderer/core/layout/store/LayoutStore.ts`
**Location**: Add performance tracking (~Line 400+)

**Implementation**:
```typescript
// TODO: Add performance monitoring
interface PerformanceMetrics {
  hitTestCount: number
  averageHitTestTime: number
  spatialIndexQueries: number
  fallbackQueries: number
  memoryUsage: {
    nodes: number
    slots: number
    links: number
  }
}

export class LayoutStore {
  private metrics: PerformanceMetrics = {
    hitTestCount: 0,
    averageHitTestTime: 0,
    spatialIndexQueries: 0,
    fallbackQueries: 0,
    memoryUsage: { nodes: 0, slots: 0, links: 0 }
  }
  
  queryLinkAtPoint(point: [number, number]): LinkLayoutData | null {
    const startTime = performance.now()
    const result = this.linkSpatialIndex.query(point)
    
    this.updateMetrics(performance.now() - startTime, !!result)
    return result
  }
  
  private updateMetrics(duration: number, hitSuccess: boolean) {
    this.metrics.hitTestCount++
    this.metrics.averageHitTestTime = 
      (this.metrics.averageHitTestTime + duration) / 2
    
    if (hitSuccess) {
      this.metrics.spatialIndexQueries++
    } else {
      this.metrics.fallbackQueries++
    }
  }
  
  // TODO: Add metrics reporting
  getPerformanceReport(): PerformanceMetrics {
    this.metrics.memoryUsage = {
      nodes: this.ynodes.size,
      slots: this.yslots.size,
      links: this.ylinks.size
    }
    
    return { ...this.metrics }
  }
}
```

## Implementation Priority

1. **Phase 1** (Critical): Tasks 1-4 - Fix memory leaks and race conditions
2. **Phase 2** (High Priority): Tasks 5-8 - Coordinate systems and error handling  
3. **Phase 3** (Architecture): Task 9 - Split responsibilities
4. **Phase 4** (Quality): Tasks 10-11 - Testing and monitoring

Each phase should be implemented and tested independently to maintain system stability.