import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  LayoutChange,
  NodeLayout,
  SlotLayout
} from '@/renderer/core/layout/types'

describe('layoutStore CRDT operations', () => {
  beforeEach(() => {
    // Clear the store before each test
    layoutStore.initializeFromLiteGraph([])
  })
  // Helper to create test node data
  const createTestNode = (id: string): NodeLayout => ({
    id,
    position: { x: 100, y: 100 },
    size: { width: 200, height: 100 },
    zIndex: 0,
    visible: true,
    bounds: { x: 100, y: 100, width: 200, height: 100 }
  })

  it('should create and retrieve nodes', () => {
    const nodeId = 'test-node-1'
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.setSource(LayoutSource.External)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Retrieve node
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value).toEqual(layout)
  })

  it('should move nodes', () => {
    const nodeId = 'test-node-2'
    const layout = createTestNode(nodeId)

    // Create node first
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Move node
    const newPosition = { x: 200, y: 300 }
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: newPosition,
      previousPosition: layout.position,
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    // Verify position updated
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.position).toEqual(newPosition)
  })

  it('should resize nodes', () => {
    const nodeId = 'test-node-3'
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Resize node
    const newSize = { width: 300, height: 150 }
    layoutStore.applyOperation({
      type: 'resizeNode',
      entity: 'node',
      nodeId,
      size: newSize,
      previousSize: layout.size,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Verify size updated
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.size).toEqual(newSize)
  })

  it('should delete nodes', () => {
    const nodeId = 'test-node-4'
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Delete node
    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      nodeId,
      previousLayout: layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Verify node deleted
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value).toBeNull()
  })

  it('should handle source and actor tracking', async () => {
    const nodeId = 'test-node-5'
    const layout = createTestNode(nodeId)

    // Set source and actor
    layoutStore.setSource(LayoutSource.Vue)
    layoutStore.setActor('user-123')

    // Track change notifications AFTER setting source/actor
    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: layoutStore.getCurrentSource(),
      actor: layoutStore.getCurrentActor()
    })

    // onChange notifications are deferred to a microtask.
    await vi.waitFor(() => {
      expect(changes.length).toBeGreaterThanOrEqual(1)
    })

    const lastChange = changes[changes.length - 1]
    expect(lastChange.source).toBe('vue')
    expect(lastChange.operation.actor).toBe('user-123')

    unsubscribe()
  })

  it('should only notify node-scoped listeners for their node', async () => {
    const nodeA = 'scoped-node-a'
    const nodeB = 'scoped-node-b'
    const layoutA = createTestNode(nodeA)
    const layoutB = createTestNode(nodeB)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId: nodeA,
      layout: layoutA,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId: nodeB,
      layout: layoutB,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const scopedChanges: LayoutChange[] = []
    const unsubscribeScoped = layoutStore.onNodeChange(nodeA, (change) => {
      scopedChanges.push(change)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: nodeB,
      position: { x: 400, y: 400 },
      previousPosition: layoutB.position,
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    await vi.waitFor(() => {
      expect(scopedChanges.length).toBe(0)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: nodeA,
      position: { x: 200, y: 250 },
      previousPosition: layoutA.position,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    await vi.waitFor(() => {
      expect(scopedChanges.length).toBe(1)
    })

    expect(scopedChanges[0].nodeIds).toContain(nodeA)
    unsubscribeScoped()
  })

  it('keeps node-scoped listeners synchronous while deferring global listeners', async () => {
    const nodeId = 'dispatch-order-node'
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const callOrder: string[] = []
    const unsubscribeNode = layoutStore.onNodeChange(nodeId, () => {
      callOrder.push('node')
    })
    const unsubscribeGlobal = layoutStore.onChange(() => {
      callOrder.push('global')
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 320, y: 180 },
      previousPosition: layout.position,
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(callOrder).toEqual(['node'])

    await Promise.resolve()

    expect(callOrder).toEqual(['node', 'global'])

    unsubscribeNode()
    unsubscribeGlobal()
  })

  it('clears node-scoped listeners when reinitializing from LiteGraph', () => {
    const nodeId = 'reinit-node'
    const staleListener = vi.fn()

    layoutStore.onNodeChange(nodeId, staleListener)

    layoutStore.initializeFromLiteGraph([
      {
        id: nodeId,
        pos: [0, 0],
        size: [200, 100]
      }
    ])

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 10, y: 20 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(staleListener).not.toHaveBeenCalled()
  })

  it('defers global listener fan-out until the microtask boundary', async () => {
    const nodeId = 'global-fanout-node'
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const globalChanges: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      globalChanges.push(change)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 120, y: 110 },
      previousPosition: layout.position,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 150, y: 140 },
      previousPosition: { x: 120, y: 110 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    expect(globalChanges).toHaveLength(0)

    await Promise.resolve()

    expect(globalChanges).toHaveLength(2)
    expect(globalChanges.map((change) => change.operation.type)).toEqual([
      'moveNode',
      'moveNode'
    ])

    unsubscribe()
  })

  it('should emit change when batch updating node bounds', async () => {
    const nodeId = 'test-node-6'
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    const newBounds = { x: 40, y: 60, width: 220, height: 120 }
    layoutStore.batchUpdateNodeBounds([{ nodeId, bounds: newBounds }])

    // onChange notifications are deferred to a microtask.
    await vi.waitFor(() => {
      expect(changes.length).toBeGreaterThan(0)
      const lastChange = changes[changes.length - 1]
      expect(lastChange.operation.type).toBe('batchUpdateBounds')
    })

    const lastChange = changes[changes.length - 1]
    if (lastChange.operation.type === 'batchUpdateBounds') {
      expect(lastChange.nodeIds).toContain(nodeId)
      expect(lastChange.operation.bounds[nodeId]?.bounds).toEqual(newBounds)
    }

    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.position).toEqual({ x: 40, y: 60 })
    expect(nodeRef.value?.size).toEqual({ width: 220, height: 120 })

    unsubscribe()
  })

  it('should query nodes by spatial bounds', () => {
    const nodes = [
      { id: 'node-a', position: { x: 0, y: 0 } },
      { id: 'node-b', position: { x: 100, y: 100 } },
      { id: 'node-c', position: { x: 250, y: 250 } }
    ]

    // Create nodes with proper bounds
    nodes.forEach(({ id, position }) => {
      const layout: NodeLayout = {
        ...createTestNode(id),
        position,
        bounds: {
          x: position.x,
          y: position.y,
          width: 200,
          height: 100
        }
      }
      layoutStore.applyOperation({
        type: 'createNode',
        entity: 'node',
        nodeId: id,
        layout,
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })
    })

    // Query nodes in bounds
    const nodesInBounds = layoutStore.queryNodesInBounds({
      x: 50,
      y: 50,
      width: 200,
      height: 200
    })

    // node-a: (0,0) to (200,100) - overlaps with query bounds (50,50) to (250,250)
    // node-b: (100,100) to (300,200) - overlaps with query bounds
    // node-c: (250,250) to (450,350) - touches corner of query bounds
    expect(nodesInBounds).toContain('node-a')
    expect(nodesInBounds).toContain('node-b')
    expect(nodesInBounds).toContain('node-c')
  })

  it('should maintain operation history', () => {
    const nodeId = 'test-node-history'
    const layout = createTestNode(nodeId)
    const startTime = Date.now()

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: startTime,
      source: LayoutSource.External,
      actor: 'test-actor'
    })

    // Move node
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 150, y: 150 },
      previousPosition: { x: 100, y: 100 },
      timestamp: startTime + 100,
      source: LayoutSource.Vue,
      actor: 'test-actor'
    })

    // Get operations by actor
    const operations = layoutStore.getOperationsByActor('test-actor')
    expect(operations.length).toBeGreaterThanOrEqual(2)
    expect(operations[0].type).toBe('createNode')
    expect(operations[1].type).toBe('moveNode')

    // Get operations since timestamp
    const recentOps = layoutStore.getOperationsSince(startTime + 50)
    expect(recentOps.length).toBeGreaterThanOrEqual(1)
    expect(recentOps[0].type).toBe('moveNode')
  })

  it('normalizes DOM-sourced heights before storing', () => {
    const nodeId = 'dom-node'
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds([
      {
        nodeId,
        bounds: {
          x: layout.bounds.x,
          y: layout.bounds.y,
          width: layout.size.width,
          height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
        }
      }
    ])

    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.size.height).toBe(layout.size.height)
    expect(nodeRef.value?.size.width).toBe(layout.size.width)
    expect(nodeRef.value?.position).toEqual(layout.position)
  })

  it('normalizes very small DOM-sourced heights safely', () => {
    const nodeId = 'small-dom-node'
    const layout = createTestNode(nodeId)
    layout.size.height = 10

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds([
      {
        nodeId,
        bounds: {
          x: layout.bounds.x,
          y: layout.bounds.y,
          width: layout.size.width,
          height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
        }
      }
    ])

    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.size.height).toBeGreaterThanOrEqual(0)
  })

  it('handles undefined NODE_TITLE_HEIGHT without NaN results', () => {
    const nodeId = 'undefined-title-height'
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    const originalTitleHeight = LiteGraph.NODE_TITLE_HEIGHT
    // @ts-expect-error – intentionally simulate undefined runtime value
    LiteGraph.NODE_TITLE_HEIGHT = undefined

    try {
      layoutStore.setSource(LayoutSource.DOM)
      layoutStore.batchUpdateNodeBounds([
        {
          nodeId,
          bounds: {
            x: layout.bounds.x,
            y: layout.bounds.y,
            width: layout.size.width,
            height: layout.size.height
          }
        }
      ])

      const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
      expect(nodeRef.value?.size.height).toBe(layout.size.height)
    } finally {
      LiteGraph.NODE_TITLE_HEIGHT = originalTitleHeight
    }
  })

  it.for([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])(
    'should preserve $type slot layouts when deleting a node',
    ({ type, isInput }) => {
      const nodeId = 'slot-persist-node'
      const layout = createTestNode(nodeId)

      layoutStore.applyOperation({
        type: 'createNode',
        entity: 'node',
        nodeId,
        layout,
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })

      const slotKey = getSlotKey(nodeId, 0, isInput)
      const slotLayout: SlotLayout = {
        nodeId,
        index: 0,
        type,
        position: { x: 110, y: 120 },
        bounds: { x: 105, y: 115, width: 10, height: 10 }
      }
      layoutStore.batchUpdateSlotLayouts([{ key: slotKey, layout: slotLayout }])
      expect(layoutStore.getSlotLayout(slotKey)).toEqual(slotLayout)

      layoutStore.applyOperation({
        type: 'deleteNode',
        entity: 'node',
        nodeId,
        previousLayout: layout,
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })

      // Slot layout must survive so Vue-patched components can still drag links
      expect(layoutStore.getSlotLayout(slotKey)).toEqual(slotLayout)
    }
  )
})

describe('layoutStore getNodeLayoutRef setter', () => {
  beforeEach(() => {
    layoutStore.initializeFromLiteGraph([])
  })

  const baseLayout = (): NodeLayout => ({
    id: 'ref-node',
    position: { x: 10, y: 20 },
    size: { width: 100, height: 50 },
    zIndex: 0,
    visible: true,
    bounds: { x: 10, y: 20, width: 100, height: 50 }
  })

  it('creates a node when setter receives a layout for an unknown id', () => {
    const ref = layoutStore.getNodeLayoutRef('ref-node')
    expect(ref.value).toBeNull()

    ref.value = baseLayout()

    expect(ref.value).toEqual(baseLayout())
  })

  it('emits a moveNode operation when only position changes', () => {
    const ref = layoutStore.getNodeLayoutRef('ref-node')
    ref.value = baseLayout()
    const before = Date.now()
    const moved = { ...baseLayout(), position: { x: 99, y: 88 } }

    ref.value = moved

    const ops = layoutStore.getOperationsSince(before - 1)
    expect(ops.some((op) => op.type === 'moveNode')).toBe(true)
    expect(ref.value?.position).toEqual({ x: 99, y: 88 })
  })

  it('emits a resizeNode operation when only size changes', () => {
    const ref = layoutStore.getNodeLayoutRef('ref-node')
    ref.value = baseLayout()
    const before = Date.now()
    const resized = { ...baseLayout(), size: { width: 200, height: 80 } }

    ref.value = resized

    const ops = layoutStore.getOperationsSince(before - 1)
    expect(ops.some((op) => op.type === 'resizeNode')).toBe(true)
  })

  it('emits a setNodeZIndex operation when only zIndex changes', () => {
    const ref = layoutStore.getNodeLayoutRef('ref-node')
    ref.value = baseLayout()
    const before = Date.now()
    const restacked = { ...baseLayout(), zIndex: 5 }

    ref.value = restacked

    const ops = layoutStore.getOperationsSince(before - 1)
    expect(ops.some((op) => op.type === 'setNodeZIndex')).toBe(true)
  })

  it('emits a deleteNode operation when setter receives null', () => {
    const ref = layoutStore.getNodeLayoutRef('ref-node')
    ref.value = baseLayout()
    const before = Date.now()

    ref.value = null

    const ops = layoutStore.getOperationsSince(before - 1)
    expect(ops.some((op) => op.type === 'deleteNode')).toBe(true)
    expect(ref.value).toBeNull()
  })
})

describe('layoutStore queries', () => {
  beforeEach(() => {
    layoutStore.initializeFromLiteGraph([])
  })

  const seedNode = (id: string, x: number, y: number, z = 0) => {
    const layout: NodeLayout = {
      id,
      position: { x, y },
      size: { width: 100, height: 50 },
      zIndex: z,
      visible: true,
      bounds: { x, y, width: 100, height: 50 }
    }
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId: id,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
  }

  it('getNodesInBounds returns reactive node IDs that intersect bounds', () => {
    seedNode('inside', 0, 0)
    seedNode('outside', 1000, 1000)

    const inBounds = layoutStore.getNodesInBounds({
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })

    expect(inBounds.value).toContain('inside')
    expect(inBounds.value).not.toContain('outside')
  })

  it('queryNodeAtPoint returns the top-zIndex node containing the point', () => {
    seedNode('low', 0, 0, 0)
    seedNode('high', 0, 0, 10)

    const hit = layoutStore.queryNodeAtPoint({ x: 25, y: 25 })

    expect(hit).toBe('high')
  })

  it('queryNodeAtPoint returns null when no node contains the point', () => {
    seedNode('only', 0, 0)

    const hit = layoutStore.queryNodeAtPoint({ x: 999, y: 999 })

    expect(hit).toBeNull()
  })
})

describe('layoutStore link layout updates', () => {
  beforeEach(() => {
    layoutStore.initializeFromLiteGraph([])
  })

  const stubPath = () => ({}) as unknown as Path2D
  const baseLink = (path = stubPath()) => ({
    id: 1 as const,
    path,
    bounds: { x: 0, y: 0, width: 50, height: 50 },
    centerPos: { x: 25, y: 25 },
    sourceNodeId: 'a',
    targetNodeId: 'b',
    sourceSlot: 0,
    targetSlot: 0
  })

  it('updateLinkLayout short-circuits when bounds and centerPos are unchanged', () => {
    layoutStore.updateLinkLayout(1, baseLink())
    const newPath = stubPath()

    layoutStore.updateLinkLayout(1, baseLink(newPath))

    expect(layoutStore.getLinkLayout(1)?.path).toBe(newPath)
  })

  it('updateLinkLayout replaces stored layout when bounds change', () => {
    layoutStore.updateLinkLayout(1, baseLink())
    const moved = {
      ...baseLink(),
      bounds: { x: 10, y: 10, width: 50, height: 50 }
    }

    layoutStore.updateLinkLayout(1, moved)

    expect(layoutStore.getLinkLayout(1)?.bounds.x).toBe(10)
  })

  it('deleteLinkLayout removes the link and its segment layouts', () => {
    layoutStore.updateLinkLayout(1, baseLink())
    layoutStore.updateLinkSegmentLayout(1, null, {
      path: stubPath(),
      bounds: { x: 0, y: 0, width: 5, height: 5 },
      centerPos: { x: 1, y: 1 }
    })

    layoutStore.deleteLinkLayout(1)

    expect(layoutStore.getLinkLayout(1)).toBeNull()
  })
})
