import { toGroupId } from '@/types/groupId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { nextTick, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'
import type { UUID } from '@/utils/uuid'

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

const GRAPH = createUuidv4()

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

  function createRemoteDoc(): Y.Doc {
    const remote = new Y.Doc()
    Y.applyUpdate(remote, layoutStore.getStateAsUpdate())
    return remote
  }

  function readRect(nodeId: NodeId): number[] | null {
    const out = new Float64Array(4)
    return layoutStore.readNodeRect(GRAPH, nodeId, out) ? [...out] : null
  }

  function applyRemoteChanges(remote: Y.Doc, change: () => void): void {
    const stateVector = Y.encodeStateVector(layoutStore.getYDoc())
    change()
    layoutStore.applyUpdate(Y.encodeStateAsUpdate(remote, stateVector))
  }

  it('notifies geometry once for one remote transaction across entity maps', () => {
    const remote = createRemoteDoc()
    const onGeometryChange = vi.fn()
    const stop = layoutStore.onGeometryChange(onGeometryChange)

    applyRemoteChanges(remote, () => {
      remote.transact(() => {
        const node = new Y.Map<unknown>()
        node.set('id', 'remote-transaction-node')
        node.set('position', { x: 10, y: 20 })
        node.set('size', { width: 30, height: 40 })
        node.set('zIndex', 0)
        node.set('visible', true)
        remote
          .getMap<Y.Map<unknown>>('nodes')
          .set('remote-transaction-node', node)

        const group = new Y.Map<unknown>()
        group.set('id', 1)
        group.set('bounds', { x: 50, y: 60, width: 70, height: 80 })
        remote.getMap<Y.Map<unknown>>('groups').set('remote-graph:1', group)

        const reroute = new Y.Map<unknown>()
        reroute.set('id', 2)
        reroute.set('position', { x: 90, y: 100 })
        remote.getMap<Y.Map<unknown>>('reroutes').set('remote-graph:2', reroute)
      })
    })

    expect(onGeometryChange).toHaveBeenCalledOnce()
    stop()
  })

  it('isolates errors between geometry change listeners', () => {
    const listenerError = new Error('geometry listener failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stopThrowing = layoutStore.onGeometryChange(() => {
      throw listenerError
    })
    const laterListener = vi.fn()
    const stopLater = layoutStore.onGeometryChange(laterListener)

    expect(() => {
      layoutStore.applyOperation({
        type: 'createNode',
        entity: 'node',
        graphId: GRAPH,
        nodeId: toNodeId('listener-error-node'),
        layout: createTestNode(toNodeId('listener-error-node')),
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })
    }).not.toThrow()

    expect(laterListener).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      'Error in geometry change listener:',
      listenerError
    )
    stopThrowing()
    stopLater()
    consoleError.mockRestore()
  })

  it('projects remote node moves into reactive geometry', async () => {
    const nodeId = toNodeId('remote-move')
    const layout = createTestNode(nodeId)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    const refChanges = vi.fn()
    const stop = watch(nodeRef, refChanges)
    const version = layoutStore.geometryVersion
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      remote
        .getMap<Y.Map<unknown>>('nodes')
        .get(`${GRAPH}:${nodeId}`)
        ?.set('position', { x: 500, y: 600 })
    })
    await nextTick()

    expect(layoutStore.geometryVersion).toBe(version + 1)
    expect(nodeRef.value?.position).toEqual({ x: 500, y: 600 })
    expect(refChanges).toHaveBeenCalledOnce()
    expect(readRect(nodeId)).toEqual([500, 600, 200, 100])
    stop()
  })

  it('projects remote node creation and deletion into readable geometry', () => {
    const nodeId = toNodeId('remote-create-delete')
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      const node = new Y.Map<unknown>()
      node.set('id', nodeId)
      node.set('position', { x: 300, y: 400 })
      node.set('size', { width: 50, height: 60 })
      node.set('zIndex', 0)
      node.set('visible', true)
      remote.getMap<Y.Map<unknown>>('nodes').set(`${GRAPH}:${nodeId}`, node)
    })
    expect(readRect(nodeId)).toEqual([300, 400, 50, 60])

    applyRemoteChanges(remote, () => {
      remote.getMap('nodes').delete(`${GRAPH}:${nodeId}`)
    })
    expect(readRect(nodeId)).toBeNull()
  })

  it('projects remote reroute moves into layout and spatial queries', () => {
    const graphId = createUuidv4() as UUID
    const rerouteId = toRerouteId(42)
    layoutStore.applyOperation({
      type: 'createReroute',
      entity: 'reroute',
      graphId,
      rerouteId,
      position: { x: 20, y: 30 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    const remote = createRemoteDoc()

    applyRemoteChanges(remote, () => {
      remote
        .getMap<Y.Map<unknown>>('reroutes')
        .get(`${graphId}:${rerouteId}`)
        ?.set('position', { x: 400, y: 500 })
    })

    expect(layoutStore.getRerouteLayout(graphId, rerouteId)?.position).toEqual({
      x: 400,
      y: 500
    })
    expect(
      layoutStore.queryRerouteAtPoint(graphId, { x: 20, y: 30 })
    ).toBeNull()
    expect(
      layoutStore.queryRerouteAtPoint(graphId, { x: 400, y: 500 })?.id
    ).toBe(rerouteId)
  })

  it('should create and retrieve nodes', () => {
    const nodeId = toNodeId('test-node-1')
    const layout = createTestNode(nodeId)

    // Create node
    layoutStore.setSource(LayoutSource.External)
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Retrieve node
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value).toEqual(layout)
  })

  it('should move nodes', () => {
    const nodeId = toNodeId('test-node-2')
    const layout = createTestNode(nodeId)

    // Create node first
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
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
      entity: 'node',
      graphId: GRAPH,
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
      entity: 'node',
      graphId: GRAPH,
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
      graphId: GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    // Verify node deleted
    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
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
      graphId: GRAPH,
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
      graphId: GRAPH,
      nodeId: nodeA,
      layout: layoutA,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId: nodeB,
      layout: layoutB,
      timestamp: Date.now(),
      source: LayoutSource.External,
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
      entity: 'node',
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
      entity: 'node',
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

  it('keeps node-scoped listeners synchronous while deferring global listeners', async () => {
    const nodeId = toNodeId('dispatch-order-node')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
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
      entity: 'node',
      graphId: GRAPH,
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

    layoutStore.onNodeChange(GRAPH, nodeId, staleListener)

    layoutStore.clearViewGeometry()
    canvasLayoutMutations().createNode(GRAPH, nodeId, {
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      zIndex: 0,
      visible: true
    })

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
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
      entity: 'node',
      graphId: GRAPH,
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
      graphId: GRAPH,
      nodeId,
      position: { x: 120, y: 110 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      graphId: GRAPH,
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
      graphId: GRAPH,
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
    layoutStore.batchUpdateNodeBounds(GRAPH, [{ nodeId, bounds: newBounds }])

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
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds(GRAPH, [
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
      entity: 'node',
      graphId: GRAPH,
      nodeId,
      layout,
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })

    layoutStore.setSource(LayoutSource.DOM)
    layoutStore.batchUpdateNodeBounds(GRAPH, [
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

    const nodeRef = layoutStore.getNodeLayoutRef(GRAPH, nodeId)
    expect(nodeRef.value?.size.height).toBeGreaterThanOrEqual(0)
  })

  it('handles undefined NODE_TITLE_HEIGHT without NaN results', () => {
    const nodeId = toNodeId('undefined-title-height')
    const layout = createTestNode(nodeId)

    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      graphId: GRAPH,
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
      layoutStore.batchUpdateNodeBounds(GRAPH, [
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
        graphId: GRAPH,
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
        graphId: GRAPH,
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
      entity: 'node',
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

    layoutStore.applyOperation({
      type: 'deleteNode',
      entity: 'node',
      graphId: FIRST_GRAPH,
      nodeId,
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })

    expect(layoutStore.getNodeLayoutRef(FIRST_GRAPH, nodeId).value).toBeNull()
    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value?.position
    ).toEqual({ x: 100, y: 0 })
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

    for (const graphId of [FIRST_GRAPH, SECOND_GRAPH]) {
      layoutStore.applyOperation({
        type: 'createGroup',
        entity: 'group',
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
        entity: 'reroute',
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
    expect(layoutStore.getGroupLayout(FIRST_GRAPH, GROUP_ID)).toBeNull()
    expect(layoutStore.getRerouteLayout(FIRST_GRAPH, REROUTE_ID)).toBeNull()

    expect(
      layoutStore.getNodeLayoutRef(SECOND_GRAPH, nodeId).value
    ).not.toBeNull()
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
    const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
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
      const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
      ref.value = baseLayout()

      const operations = getOperationsAddedBy(() => {
        ref.value = nextLayout
      })

      expectSingleOperation(operations, expectedOperation)
      expect(ref.value).toEqual(nextLayout)
    }
  )

  it('ignores a null assignment; deletion goes through layoutMutations.deleteNode', () => {
    const ref = layoutStore.getNodeLayoutRef(GRAPH, REF_NODE)
    const layout = baseLayout()
    ref.value = layout

    const operations = getOperationsAddedBy(() => {
      ref.value = null
    })

    expect(operations).toEqual([])
    expect(ref.value).toEqual(layout)
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
