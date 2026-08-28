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
import type { UUID } from '@/utils/uuid'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type {
  LayoutChange,
  LayoutOperation,
  NodeLayout
} from '@/renderer/core/layout/types'

const GRAPH = createUuidv4()

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
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Retrieve node
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value).toEqual(layout)
  })

  it('does not create a node when reading a missing layout', () => {
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, toNodeId('missing'))

    expect(nodeRef.value).toBeNull()
    expect(layoutStore.nodeCount).toBe(0)
  })

  it('should move nodes', () => {
    const nodeId = toNodeId('test-node-2')
    const layout = createTestNode(nodeId)

    // Create node first
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Move node
    const newPosition = { x: 200, y: 300 }
    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
      nodeId,
      position: newPosition,
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    // Verify position updated
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.position).toEqual(newPosition)
  })

  it('should resize nodes', () => {
    const nodeId = toNodeId('test-node-3')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Resize node
    const newSize = { width: 300, height: 150 }
    layoutStore.applyOperation({
      type: 'resizeNode',
      graphId: GRAPH,
      nodeId,
      size: newSize,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Verify size updated
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size).toEqual(newSize)
  })

  it('should delete nodes', () => {
    const nodeId = toNodeId('test-node-4')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Delete node
    layoutStore.applyOperation({
      type: 'deleteNode',
      graphId: GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    // Verify node deleted
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value).toBeNull()
  })

  it('carries the operation source and stamps one session actor', async () => {
    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    for (const nodeId of [toNodeId('test-node-5a'), toNodeId('test-node-5b')]) {
      layoutStore.applyOperation({
        type: 'createNode',
        graphId: GRAPH,
        nodeId,
        layout: createTestNode(nodeId),
        timestamp: Date.now(),
        source: LayoutSource.Vue
      })
    }

    // onChange notifications are deferred to a microtask.
    await vi.waitFor(() => {
      expect(changes.length).toBe(2)
    })

    const [first, second] = changes
    expect(first.source).toBe(LayoutSource.Vue)
    expect(first.operation.actor).toEqual(expect.any(String))
    expect(second.operation.actor).toBe(first.operation.actor)

    unsubscribe()
  })

  it('should only notify node-scoped listeners for their node', async () => {
    const nodeA = toNodeId('scoped-node-a')
    const nodeB = toNodeId('scoped-node-b')
    const layoutA = createTestNode(nodeA)
    const layoutB = createTestNode(nodeB)

    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId: nodeA,
      layout: layoutA,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId: nodeB,
      layout: layoutB,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    const scopedChanges: LayoutChange[] = []
    const unsubscribeScoped = layoutStore.onNodeChange(
      GRAPH,
      nodeA,
      (change) => {
        scopedChanges.push(change)
      }
    )

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
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
      graphId: GRAPH,
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

  it('defers node-scoped and global listeners', async () => {
    const nodeId = toNodeId('dispatch-order-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    const callOrder: string[] = []
    const unsubscribeNode = layoutStore.onNodeChange(GRAPH, nodeId, () => {
      callOrder.push('node')
    })
    const unsubscribeGlobal = layoutStore.onChange(() => {
      callOrder.push('global')
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
      nodeId,
      position: { x: 320, y: 180 },
      timestamp: Date.now(),
      source: LayoutSource.Vue,
      actor: 'test'
    })

    expect(callOrder).toEqual([])

    await Promise.resolve()

    expect(callOrder).toEqual(['node', 'global'])

    unsubscribeNode()
    unsubscribeGlobal()
  })

  it('clears node-scoped listeners when the viewed graph changes', () => {
    const nodeId = toNodeId('reinit-node')
    const staleListener = vi.fn()

    layoutStore.onNodeChange(GRAPH, nodeId, staleListener)

    layoutStore.clearViewGeometry()
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout: createTestNode(nodeId),
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
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
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    const globalChanges: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      globalChanges.push(change)
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
      nodeId,
      position: { x: 120, y: 110 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: GRAPH,
      nodeId,
      position: { x: 150, y: 140 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
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
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    const changes: LayoutChange[] = []
    const unsubscribe = layoutStore.onChange((change) => {
      changes.push(change)
    })

    const newBounds = { x: 40, y: 60, width: 220, height: 120 }
    layoutStore.batchUpdateNodeBounds(GRAPH, [{ nodeId, bounds: newBounds }], {
      source: LayoutSource.Vue
    })

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

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.position).toEqual({ x: 40, y: 60 })
    expect(nodeRef.value?.size).toEqual({ width: 220, height: 120 })

    unsubscribe()
  })

  it('normalizes DOM-sourced heights before storing', () => {
    const nodeId = toNodeId('dom-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    layoutStore.batchUpdateNodeBounds(
      GRAPH,
      [
        {
          nodeId,
          bounds: {
            x: layout.bounds.x,
            y: layout.bounds.y,
            width: layout.size.width,
            height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
          }
        }
      ],
      { source: LayoutSource.Vue, boundsIncludeTitleHeight: true }
    )

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
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
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    layoutStore.batchUpdateNodeBounds(
      GRAPH,
      [
        {
          nodeId,
          bounds: {
            x: layout.bounds.x,
            y: layout.bounds.y,
            width: layout.size.width,
            height: layout.size.height + LiteGraph.NODE_TITLE_HEIGHT
          }
        }
      ],
      { source: LayoutSource.Vue, boundsIncludeTitleHeight: true }
    )

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size.height).toBeGreaterThanOrEqual(0)
  })

  it('handles undefined NODE_TITLE_HEIGHT without NaN results', () => {
    const nodeId = toNodeId('undefined-title-height')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
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
      layoutStore.batchUpdateNodeBounds(
        GRAPH,
        [
          {
            nodeId,
            bounds: {
              x: layout.bounds.x,
              y: layout.bounds.y,
              width: layout.size.width,
              height: layout.size.height
            }
          }
        ],
        { source: LayoutSource.Vue, boundsIncludeTitleHeight: true }
      )

      const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
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
})

describe('reroute layouts outlive an active-graph reseed', () => {
  const GRAPH_ID = createUuidv4()
  const REROUTE = toRerouteId(4242)
  const POSITION = { x: 372, y: 415 }

  function createReroute() {
    layoutStore.applyOperation({
      type: 'createReroute',
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

    layoutStore.applyOperation({
      type: 'deleteReroute',
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
        graphId,
        rerouteId: REROUTE_ID,
        position: { x: offset + 5, y: offset + 5 }
      })
    }

    apply({
      ...metadata(),
      type: 'setGroupBounds',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID,
      position: { x: 20, y: 30 },
      size: { width: 50, height: 60 }
    })
    apply({
      ...metadata(),
      type: 'moveReroute',
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

    apply({
      ...metadata(),
      type: 'deleteGroup',
      graphId: FIRST_GRAPH,
      groupId: GROUP_ID
    })
    apply({
      ...metadata(),
      type: 'deleteReroute',
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
describe('root-scoped node layouts', () => {
  const FIRST_GRAPH = createUuidv4()
  const SECOND_GRAPH = createUuidv4()
  const GROUP_ID = toGroupId(3)
  const REROUTE_ID = toRerouteId(4)

  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function seedNode(graphId: UUID, nodeId: NodeId, x: number): void {
    layoutStore.applyOperation({
      type: 'createNode',
      graphId,
      nodeId,
      layout: {
        id: nodeId,
        position: { x, y: 0 },
        size: { width: 10, height: 10 },
        zIndex: 0,
        visible: true,
        bounds: { x, y: 0, width: 10, height: 10 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
  }

  it('isolates colliding node IDs across root graphs', () => {
    const nodeId = toNodeId('1')
    seedNode(FIRST_GRAPH, nodeId, 10)
    seedNode(SECOND_GRAPH, nodeId, 100)
    layoutStore.reportContentSize(FIRST_GRAPH, nodeId, {
      width: 20,
      height: 20
    })
    layoutStore.reportContentSize(SECOND_GRAPH, nodeId, {
      width: 30,
      height: 30
    })

    layoutStore.applyOperation({
      type: 'deleteNode',
      graphId: FIRST_GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    expect(layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value).toBeNull()
    expect(layoutStore.contentSizeOf(FIRST_GRAPH, nodeId)).toBeUndefined()
    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value?.position
    ).toEqual({ x: 100, y: 0 })
    expect(layoutStore.contentSizeOf(SECOND_GRAPH, nodeId)?.width).toBe(30)
  })

  it('keys nodes whose IDs contain the scope separator', () => {
    const nodeId = toNodeId('sub:7')
    seedNode(FIRST_GRAPH, nodeId, 42)

    expect(
      layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value?.position
    ).toEqual({ x: 42, y: 0 })
    expect(layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value).toBeNull()
  })

  it('clearGraph drops one root graph and leaves the other intact', () => {
    const nodeId = toNodeId('1')
    seedNode(FIRST_GRAPH, nodeId, 10)
    seedNode(SECOND_GRAPH, nodeId, 100)
    layoutStore.reportContentSize(FIRST_GRAPH, nodeId, {
      width: 20,
      height: 20
    })
    layoutStore.reportContentSize(SECOND_GRAPH, nodeId, {
      width: 30,
      height: 30
    })
    for (const graphId of [FIRST_GRAPH, SECOND_GRAPH]) {
      layoutStore.updateNodeSlotOffsets(
        graphId,
        nodeId,
        [{ index: 0, type: 'input', position: { x: 0, y: 10 } }],
        'expanded'
      )
    }

    for (const graphId of [FIRST_GRAPH, SECOND_GRAPH]) {
      layoutStore.applyOperation({
        type: 'createGroup',
        graphId,
        groupId: GROUP_ID,
        layout: {
          id: GROUP_ID,
          position: { x: 0, y: 0 },
          size: { width: 5, height: 5 }
        },
        timestamp: Date.now(),
        source: LayoutSource.Canvas,
        actor: 'test'
      })
      layoutStore.applyOperation({
        type: 'createReroute',
        graphId,
        rerouteId: REROUTE_ID,
        position: { x: 0, y: 0 },
        timestamp: Date.now(),
        source: LayoutSource.Canvas,
        actor: 'test'
      })
    }

    layoutStore.clearGraph(FIRST_GRAPH)

    expect(layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value).toBeNull()
    expect(layoutStore.contentSizeOf(FIRST_GRAPH, nodeId)).toBeUndefined()
    expect(
      layoutStore.getSlotOffset(FIRST_GRAPH, nodeId, 0, 'input', 'expanded')
    ).toBeNull()
    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)).toBeNull()
    expect(layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)).toBeNull()

    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value
    ).not.toBeNull()
    expect(layoutStore.contentSizeOf(SECOND_GRAPH, nodeId)?.width).toBe(30)
    expect(
      layoutStore.getSlotOffset(SECOND_GRAPH, nodeId, 0, 'input', 'expanded')
    ).toEqual({
      x: 0,
      y: 10
    })
    expect(layoutStore.getGroupLayout(SECOND_GRAPH, GROUP_ID)).not.toBeNull()
    expect(
      layoutStore.getRerouteLayout(SECOND_GRAPH, REROUTE_ID)
    ).not.toBeNull()
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
