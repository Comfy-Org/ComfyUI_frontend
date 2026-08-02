import { toGroupId } from '@/types/groupId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { canvasLayoutMutations } from '@/renderer/core/layout/operations/graphLayoutRegistration'
import type {
  LayoutChange,
  LayoutOperation,
  NodeLayout,
  SlotLayout
} from '@/renderer/core/layout/types'

function getOperationsAddedBy(action: () => void): LayoutOperation[] {
  const applySpy = vi.spyOn(layoutStore, 'applyOperation')
  try {
    action()
    return applySpy.mock.calls.map(([operation]) => operation)
  } finally {
    applySpy.mockRestore()
  }
}

function expectSingleOperation(
  operations: LayoutOperation[],
  expectedOperation: Record<string, unknown>
): void {
  expect(operations).toHaveLength(1)
  expect(operations[0]).toEqual(expect.objectContaining(expectedOperation))
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('layoutStore CRDT operations', () => {
  beforeEach(() => {
    // Clear the store before each test
    layoutStore.resetForTests()
  })
  // Helper to create test node data
  const createTestNode = (id: NodeId): NodeLayout => ({
    id,
    position: { x: 100, y: 100 },
    size: { width: 200, height: 100 },
    zIndex: 0,
    visible: true,
    bounds: { x: 100, y: 100, width: 200, height: 100 }
  })

  it('should create and retrieve nodes', () => {
    const nodeId = toNodeId('test-node-1')
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
    const nodeId = toNodeId('test-node-2')
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
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    // Verify position updated
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.position).toEqual(newPosition)
  })

  it('should resize nodes', () => {
    const nodeId = toNodeId('test-node-3')
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
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Verify size updated
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.size).toEqual(newSize)
  })

  it('should delete nodes', () => {
    const nodeId = toNodeId('test-node-4')
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
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Verify node deleted
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value).toBeNull()
  })

  it('should handle source and actor tracking', async () => {
    const nodeId = toNodeId('test-node-5')
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
    const nodeA = toNodeId('scoped-node-a')
    const nodeB = toNodeId('scoped-node-b')
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
    const nodeId = toNodeId('dispatch-order-node')
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

  it('clears node-scoped listeners when the viewed graph changes', () => {
    const nodeId = toNodeId('reinit-node')
    const staleListener = vi.fn()

    layoutStore.onNodeChange(nodeId, staleListener)

    layoutStore.clearViewGeometry()
    canvasLayoutMutations().createNode(nodeId, {
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      zIndex: 0,
      visible: true
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 10, y: 20 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(staleListener).not.toHaveBeenCalled()
  })

  it('defers global listener fan-out until the microtask boundary', async () => {
    const nodeId = toNodeId('global-fanout-node')
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
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId,
      position: { x: 150, y: 140 },
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
    const nodeId = toNodeId('test-node-6')
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
      expect(lastChange.operation.bounds[nodeId]).toEqual(newBounds)
    }

    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
    expect(nodeRef.value?.position).toEqual({ x: 40, y: 60 })
    expect(nodeRef.value?.size).toEqual({ width: 220, height: 120 })

    unsubscribe()
  })

  it('should query nodes by spatial bounds', () => {
    const nodes = [
      { id: toNodeId('node-a'), position: { x: 0, y: 0 } },
      { id: toNodeId('node-b'), position: { x: 100, y: 100 } },
      { id: toNodeId('node-c'), position: { x: 250, y: 250 } }
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

  it('normalizes DOM-sourced heights before storing', () => {
    const nodeId = toNodeId('dom-node')
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
    const nodeId = toNodeId('small-dom-node')
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
    const nodeId = toNodeId('undefined-title-height')
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

    const originalTitleHeightDescriptor = Object.getOwnPropertyDescriptor(
      LiteGraph,
      'NODE_TITLE_HEIGHT'
    )
    Object.defineProperty(LiteGraph, 'NODE_TITLE_HEIGHT', {
      configurable: true,
      value: undefined,
      writable: true
    })

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
      if (originalTitleHeightDescriptor) {
        Object.defineProperty(
          LiteGraph,
          'NODE_TITLE_HEIGHT',
          originalTitleHeightDescriptor
        )
      }
    }
  })

  it.for([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])(
    'should preserve $type slot layouts when deleting a node',
    ({ type, isInput }) => {
      const nodeId = toNodeId('slot-persist-node')
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
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })

      // Slot layout must survive so Vue-patched components can still drag links
      expect(layoutStore.getSlotLayout(slotKey)).toEqual(slotLayout)
    }
  )
})

describe('reroute layouts outlive an active-graph reseed', () => {
  const GRAPH_ID = createUuidv4()
  const REROUTE = toRerouteId(4242)
  const POSITION = { x: 372, y: 415 }

  function createReroute() {
    layoutStore.setSource(LayoutSource.Canvas)
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      graphId: GRAPH_ID,
      rerouteId: REROUTE,
      position: POSITION,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  it('survives the view change that follows subgraph navigation', () => {
    createReroute()

    layoutStore.clearViewGeometry()

    expect(layoutStore.getRerouteLayout(GRAPH_ID, REROUTE)?.position).toEqual(
      POSITION
    )
    expect(layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)?.id).toBe(
      REROUTE
    )
  })

  it('drops layout and spatial index together on delete', () => {
    createReroute()

    layoutStore.setSource(LayoutSource.Canvas)
    layoutStore.applyOperation({
      type: 'deleteReroute',
      entity: 'reroute',
      graphId: GRAPH_ID,
      rerouteId: REROUTE,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    expect(layoutStore.getRerouteLayout(GRAPH_ID, REROUTE)).toBeNull()
    expect(layoutStore.queryRerouteAtPoint(GRAPH_ID, POSITION)).toBeNull()
  })
})

describe('root-scoped group and reroute layouts', () => {
  const FIRST_GRAPH = createUuidv4()
  const SECOND_GRAPH = createUuidv4()
  const GROUP_ID = toGroupId(77)
  const REROUTE_ID = toRerouteId(88)

  function apply(operation: LayoutOperation): void {
    layoutStore.applyOperation(operation)
  }

  function metadata() {
    return {
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    } as const
  }

  it('isolates colliding local IDs across reads, moves, queries, deletes, and clears', () => {
    for (const [graphId, offset] of [
      [FIRST_GRAPH, 10],
      [SECOND_GRAPH, 100]
    ] as const) {
      apply({
        ...metadata(),
        type: 'createGroup',
        entity: 'group',
        graphId,
        groupId: GROUP_ID,
        layout: {
          id: GROUP_ID,
          position: { x: offset, y: offset },
          size: { width: 40, height: 40 }
        }
      })
      apply({
        ...metadata(),
        type: 'createReroute',
        entity: 'reroute',
        graphId,
        rerouteId: REROUTE_ID,
        position: { x: offset + 5, y: offset + 5 }
      })
    }

    apply({
      ...metadata(),
      type: 'setGroupBounds',
      entity: 'group',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID,
      position: { x: 20, y: 30 },
      size: { width: 50, height: 60 }
    })
    apply({
      ...metadata(),
      type: 'moveReroute',
      entity: 'reroute',
      graphId: FIRST_GRAPH,
      rerouteId: REROUTE_ID,
      position: { x: 25, y: 35 }
    })

    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)?.position).toEqual(
      { x: 20, y: 30 }
    )
    expect(
      layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)?.position
    ).toEqual({ x: 100, y: 100 })
    expect(layoutStore.getAllGroups(FIRST_GRAPH).value.size).toBe(1)
    expect(layoutStore.getAllGroups(SECOND_GRAPH).value.size).toBe(1)
    expect(
      layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)?.position
    ).toEqual({ x: 25, y: 35 })
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)?.position
    ).toEqual({ x: 105, y: 105 })
    expect(
      layoutStore.queryRerouteAtPoint(FIRST_GRAPH, { x: 25, y: 35 })?.id
    ).toBe(REROUTE_ID)
    expect(
      layoutStore.queryRerouteAtPoint(SECOND_GRAPH, { x: 25, y: 35 })
    ).toBeNull()
    expect(
      layoutStore.queryItemsInBounds(FIRST_GRAPH, {
        x: 0,
        y: 0,
        width: 50,
        height: 50
      }).reroutes
    ).toEqual([REROUTE_ID])
    expect(
      layoutStore.queryItemsInBounds(SECOND_GRAPH, {
        x: 0,
        y: 0,
        width: 50,
        height: 50
      }).reroutes
    ).toEqual([])

    apply({
      ...metadata(),
      type: 'deleteGroup',
      entity: 'group',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID
    })
    apply({
      ...metadata(),
      type: 'deleteReroute',
      entity: 'reroute',
      graphId: FIRST_GRAPH,
      rerouteId: REROUTE_ID
    })
    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)).toBeNull()
    expect(layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)).toBeNull()
    expect(layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)).not.toBeNull()
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)
    ).not.toBeNull()
  })
})
describe('layoutStore getNodeLayoutRef setter', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  const REF_NODE = toNodeId('ref-node')

  function baseLayout(): NodeLayout {
    return {
      id: REF_NODE,
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      zIndex: 0,
      visible: true,
      bounds: { x: 10, y: 20, width: 100, height: 50 }
    }
  }

  it('creates a node when setter receives a layout for an unknown id', () => {
    const ref = layoutStore.getNodeLayoutRef(REF_NODE)
    const layout = baseLayout()
    expect(ref.value).toBeNull()

    const operations = getOperationsAddedBy(() => {
      ref.value = layout
    })

    expectSingleOperation(operations, {
      type: 'createNode',
      nodeId: REF_NODE,
      layout
    })
    expect(ref.value).toEqual(layout)
  })

  it.for<{
    name: string
    nextLayout: NodeLayout
    expectedOperation: Record<string, unknown>
  }>([
    {
      name: 'moveNode',
      nextLayout: {
        ...baseLayout(),
        position: { x: 99, y: 88 },
        bounds: { x: 99, y: 88, width: 100, height: 50 }
      },
      expectedOperation: {
        type: 'moveNode',
        nodeId: REF_NODE,
        position: { x: 99, y: 88 }
      }
    },
    {
      name: 'resizeNode',
      nextLayout: {
        ...baseLayout(),
        size: { width: 200, height: 80 },
        bounds: { x: 10, y: 20, width: 200, height: 80 }
      },
      expectedOperation: {
        type: 'resizeNode',
        nodeId: REF_NODE,
        size: { width: 200, height: 80 }
      }
    },
    {
      name: 'setNodeZIndex',
      nextLayout: { ...baseLayout(), zIndex: 5 },
      expectedOperation: {
        type: 'setNodeZIndex',
        nodeId: REF_NODE,
        zIndex: 5
      }
    }
  ])(
    'emits a $name operation for layout-only updates',
    ({ nextLayout, expectedOperation }) => {
      const ref = layoutStore.getNodeLayoutRef(REF_NODE)
      ref.value = baseLayout()

      const operations = getOperationsAddedBy(() => {
        ref.value = nextLayout
      })

      expectSingleOperation(operations, expectedOperation)
      expect(ref.value).toEqual(nextLayout)
    }
  )

  it('ignores a null assignment; deletion goes through layoutMutations.deleteNode', () => {
    const ref = layoutStore.getNodeLayoutRef(REF_NODE)
    const layout = baseLayout()
    ref.value = layout

    const operations = getOperationsAddedBy(() => {
      ref.value = null
    })

    expect(operations).toEqual([])
    expect(ref.value).toEqual(layout)
  })
})

describe('layoutStore queries', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  const seedNode = (id: NodeId, x: number, y: number, z = 0) => {
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
    seedNode(toNodeId('inside'), 0, 0)
    seedNode(toNodeId('outside'), 1000, 1000)

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
    seedNode(toNodeId('low'), 0, 0, 0)
    seedNode(toNodeId('high'), 0, 0, 10)

    const hit = layoutStore.queryNodeAtPoint({ x: 25, y: 25 })

    expect(hit).toBe('high')
  })

  it('queryNodeAtPoint returns null when no node contains the point', () => {
    seedNode(toNodeId('only'), 0, 0)

    const hit = layoutStore.queryNodeAtPoint({ x: 999, y: 999 })

    expect(hit).toBeNull()
  })
})

describe('layoutStore link layout updates', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  const stubPath = () => fromPartial<Path2D>({})
  const baseLink = (path = stubPath()) => ({
    id: toLinkId(1),
    path,
    bounds: { x: 0, y: 0, width: 50, height: 50 },
    centerPos: { x: 25, y: 25 },
    sourceNodeId: toNodeId('a'),
    targetNodeId: toNodeId('b'),
    sourceSlot: 0,
    targetSlot: 0
  })

  it('updateLinkLayout short-circuits when bounds and centerPos are unchanged', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    const newPath = stubPath()

    layoutStore.updateLinkLayout(toLinkId(1), baseLink(newPath))

    expect(layoutStore.getLinkLayout(toLinkId(1))?.path).toBe(newPath)
  })

  it('updateLinkLayout replaces stored layout when bounds change', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    const moved = {
      ...baseLink(),
      bounds: { x: 10, y: 10, width: 50, height: 50 }
    }

    layoutStore.updateLinkLayout(toLinkId(1), moved)

    expect(layoutStore.getLinkLayout(toLinkId(1))?.bounds.x).toBe(10)
  })

  it('deleteLinkLayout removes the link and its segment layouts', () => {
    layoutStore.updateLinkLayout(toLinkId(1), baseLink())
    layoutStore.updateLinkSegmentLayout(toLinkId(1), null, {
      path: stubPath(),
      bounds: { x: 0, y: 0, width: 5, height: 5 },
      centerPos: { x: 1, y: 1 }
    })

    expect(layoutStore.queryLinkSegmentAtPoint({ x: 1, y: 1 })).toEqual({
      linkId: toLinkId(1),
      rerouteId: null
    })

    layoutStore.deleteLinkLayout(toLinkId(1))

    expect(layoutStore.getLinkLayout(toLinkId(1))).toBeNull()
    expect(layoutStore.queryLinkSegmentAtPoint({ x: 1, y: 1 })).toBeNull()
  })
})
