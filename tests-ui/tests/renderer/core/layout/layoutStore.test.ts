import { beforeEach, describe, expect, it } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  type LayoutChange,
  LayoutSource,
  type NodeLayout
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

    // Wait for async notification
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(changes.length).toBeGreaterThanOrEqual(1)
    const lastChange = changes[changes.length - 1]
    expect(lastChange.source).toBe('vue')
    expect(lastChange.operation.actor).toBe('user-123')

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
})
