import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type * as Y from 'yjs'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toGroupId } from '@/types/groupId'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

import { useLayoutMutations } from './layoutMutations'

const GRAPH = createUuidv4()
const NODE_1 = toNodeId('1')
const NODE_2 = toNodeId('2')
const MISSING_NODE = toNodeId('999')
const NEW_NODE = toNodeId('99')

function seedNode(
  nodeId: NodeId,
  [x, y]: [number, number],
  [width, height]: [number, number],
  zIndex: number
) {
  useLayoutMutations().createNode(GRAPH, nodeId, {
    position: { x, y },
    size: { width, height },
    zIndex,
    visible: true
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  layoutStore.resetForTests()
  seedNode(NODE_1, [10, 20], [200, 100], 0)
  seedNode(NODE_2, [300, 400], [150, 80], 1)
})

describe('moveNode', () => {
  it('does nothing when node does not exist', () => {
    const { moveNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    moveNode(GRAPH, MISSING_NODE, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates node position', () => {
    const { moveNode } = useLayoutMutations()
    moveNode(GRAPH, NODE_1, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.position).toEqual(
      {
        x: 100,
        y: 200
      }
    )
  })

  it('preserves a registered node when ownership does not match', () => {
    const { createNode } = useLayoutMutations()
    createNode(GRAPH, NEW_NODE, { position: { x: 10, y: 20 } })
    layoutStore
      .getYDocForTests()
      .getMap<Y.Map<unknown>>('nodes')
      .get(`${GRAPH}:${NEW_NODE}`)
      ?.set('registrationId', 'owner')

    layoutStore.applyOperation({
      actor: layoutStore.getCurrentActor(),
      entity: 'node',
      graphId: GRAPH,
      nodeId: NEW_NODE,
      position: { x: 100, y: 200 },
      registrationId: 'foreign',
      source: layoutStore.getCurrentSource(),
      timestamp: Date.now(),
      type: 'moveNode'
    })

    expect(
      layoutStore.getNodeLayoutRef(GRAPH, NEW_NODE).value?.position
    ).toEqual({
      x: 10,
      y: 20
    })
  })
})

describe('resizeNode', () => {
  it('does nothing when node does not exist', () => {
    const { resizeNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    resizeNode(GRAPH, MISSING_NODE, { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates node size', () => {
    const { resizeNode } = useLayoutMutations()
    resizeNode(GRAPH, NODE_1, { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.size).toEqual({
      width: 400,
      height: 200
    })
  })
})

describe('setNodeZIndex', () => {
  it('does nothing when node does not exist', () => {
    const { setNodeZIndex } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    setNodeZIndex(GRAPH, MISSING_NODE, 10)
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates node z-index', () => {
    const { setNodeZIndex } = useLayoutMutations()
    setNodeZIndex(GRAPH, NODE_1, 42)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex).toBe(42)
  })
})

describe('createNode', () => {
  it('makes node accessible via getNodeLayoutRef', () => {
    const { createNode } = useLayoutMutations()
    createNode(GRAPH, NEW_NODE, {
      position: { x: 50, y: 60 },
      size: { width: 300, height: 150 }
    })
    const layout = layoutStore.getNodeLayoutRef(GRAPH, NEW_NODE).value
    expect(layout?.position).toEqual({ x: 50, y: 60 })
    expect(layout?.size).toEqual({ width: 300, height: 150 })
  })
})

describe('deleteNode', () => {
  it('does nothing when node does not exist', () => {
    const { deleteNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    deleteNode(GRAPH, MISSING_NODE)
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('removes node from the store', () => {
    const { deleteNode } = useLayoutMutations()
    deleteNode(GRAPH, NODE_1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toBeNull()
  })

  it('requires exact ownership evidence for registered nodes', () => {
    const { createNode, deleteNode } = useLayoutMutations()
    createNode(GRAPH, NEW_NODE, {})
    layoutStore
      .getYDocForTests()
      .getMap<Y.Map<unknown>>('nodes')
      .get(`${GRAPH}:${NEW_NODE}`)
      ?.set('registrationId', '')

    expect(deleteNode(GRAPH, NEW_NODE)).toBe('no-op')
    const deleteWithRegistration = (registrationId: string) =>
      layoutStore.applyOperation({
        actor: layoutStore.getCurrentActor(),
        entity: 'node',
        graphId: GRAPH,
        nodeId: NEW_NODE,
        registrationId,
        source: layoutStore.getCurrentSource(),
        timestamp: Date.now(),
        type: 'deleteNode'
      })
    expect(deleteWithRegistration('foreign')).toBe('no-op')
    expect(deleteWithRegistration('')).toBe('applied')
    expect(layoutStore.getNodeLayoutRef(GRAPH, NEW_NODE).value).toBeNull()
  })
})

describe('batchMoveNodes', () => {
  it('does nothing when updates array is empty', () => {
    const { batchMoveNodes } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    batchMoveNodes(GRAPH, [])
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates positions for all found nodes', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes(GRAPH, [
      { nodeId: NODE_1, position: { x: 50, y: 60 } },
      { nodeId: NODE_2, position: { x: 70, y: 80 } }
    ])
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.position).toEqual(
      {
        x: 50,
        y: 60
      }
    )
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.position).toEqual(
      {
        x: 70,
        y: 80
      }
    )
  })

  it('preserves existing node size when moving', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes(GRAPH, [{ nodeId: NODE_1, position: { x: 50, y: 60 } }])
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.size).toEqual({
      width: 200,
      height: 100
    })
  })

  it('skips nodes not found in the store', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes(GRAPH, [
      { nodeId: MISSING_NODE, position: { x: 0, y: 0 } },
      { nodeId: NODE_1, position: { x: 50, y: 60 } }
    ])
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.position).toEqual(
      {
        x: 50,
        y: 60
      }
    )
  })
})

describe('bringNodeToFront', () => {
  it('gives the node a higher z-index than all other nodes', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(GRAPH, NODE_2, 10)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('gives the node a higher z-index when all nodes start at the same level', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(GRAPH, NODE_1, 5)
    setNodeZIndex(GRAPH, NODE_2, 5)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('remains frontmost when the already-leading node is brought to front again', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(GRAPH, NODE_1, 20)
    setNodeZIndex(GRAPH, NODE_2, 5)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})

describe('deleting an entity that is already gone', () => {
  it('emits nothing for a group', () => {
    const rootGraphId = createUuidv4()
    const groupId = toGroupId(1)
    const { createGroup, deleteGroup } = useLayoutMutations()
    createGroup(rootGraphId, groupId, {
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 }
    })
    deleteGroup(rootGraphId, groupId)
    expect(layoutStore.getGroupLayout(rootGraphId, groupId)).toBeNull()

    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    deleteGroup(rootGraphId, groupId)

    expect(applyOperation).not.toHaveBeenCalled()
  })

  it('emits nothing for a reroute', () => {
    const rootGraphId = createUuidv4()
    const rerouteId = toRerouteId(1)
    const { createReroute, deleteReroute } = useLayoutMutations()
    createReroute(rootGraphId, rerouteId, { x: 10, y: 10 })
    deleteReroute(rootGraphId, rerouteId)
    expect(layoutStore.getRerouteLayout(rootGraphId, rerouteId)).toBeNull()

    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    deleteReroute(rootGraphId, rerouteId)

    expect(applyOperation).not.toHaveBeenCalled()
  })
})
