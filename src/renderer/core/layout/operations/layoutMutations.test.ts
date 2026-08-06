import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type * as Y from 'yjs'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
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

  it('forwards current registration ownership', () => {
    const { createNode, moveNode } = useLayoutMutations()
    createNode(GRAPH, NEW_NODE, { position: { x: 10, y: 20 } })
    getLayoutStoreYDoc()
      .getMap<Y.Map<unknown>>('nodes')
      .get(`${GRAPH}:${NEW_NODE}`)
      ?.set('registrationId', 'owner')

    moveNode(GRAPH, NEW_NODE, { x: 100, y: 200 })

    expect(
      layoutStore.getNodeLayoutRef(GRAPH, NEW_NODE).value?.position
    ).toEqual({
      x: 100,
      y: 200
    })
  })
})

describe('resizeNode', () => {
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

describe('missing node mutations', () => {
  it.for([
    {
      name: 'moveNode',
      mutate: () =>
        useLayoutMutations().moveNode(GRAPH, MISSING_NODE, { x: 1, y: 2 })
    },
    {
      name: 'resizeNode',
      mutate: () =>
        useLayoutMutations().resizeNode(GRAPH, MISSING_NODE, {
          width: 3,
          height: 4
        })
    },
    {
      name: 'setNodeZIndex',
      mutate: () => useLayoutMutations().setNodeZIndex(GRAPH, MISSING_NODE, 5)
    }
  ])('$name is a no-op', ({ mutate }) => {
    const before = [NODE_1, NODE_2].map(
      (nodeId) => layoutStore.getNodeLayoutRef(GRAPH, nodeId).value
    )

    mutate()

    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(
      [NODE_1, NODE_2].map(
        (nodeId) => layoutStore.getNodeLayoutRef(GRAPH, nodeId).value
      )
    ).toEqual(before)
  })
})

describe('batchMoveNodes', () => {
  it('updates found nodes, preserves size, and skips missing nodes', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes(GRAPH, [
      { nodeId: NODE_1, position: { x: 50, y: 60 } },
      { nodeId: NODE_2, position: { x: 70, y: 80 } },
      { nodeId: MISSING_NODE, position: { x: 0, y: 0 } }
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
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.size).toEqual({
      width: 200,
      height: 100
    })
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
  })
})

describe('bringNodeToFront', () => {
  it.for([
    { name: 'ordinary ordering', first: 0, second: 10 },
    { name: 'tied nodes', first: 5, second: 5 },
    { name: 'already leading', first: 20, second: 5 }
  ])('keeps the target frontmost with $name', ({ first, second }) => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(GRAPH, NODE_1, first)
    setNodeZIndex(GRAPH, NODE_2, second)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})

describe('deleting an entity that is already gone', () => {
  it.for([{ entity: 'group' }, { entity: 'reroute' }] as const)(
    'is a no-op for a $entity',
    ({ entity }) => {
      const rootGraphId = createUuidv4()
      const mutations = useLayoutMutations()
      if (entity === 'group') {
        const groupId = toGroupId(1)
        mutations.createGroup(rootGraphId, groupId, {
          position: { x: 0, y: 0 },
          size: { width: 100, height: 50 }
        })
        mutations.deleteGroup(rootGraphId, groupId)
        expect(mutations.deleteGroup(rootGraphId, groupId)).toBe('no-op')
        expect(layoutStore.getGroupLayout(rootGraphId, groupId)).toBeNull()
      } else {
        const rerouteId = toRerouteId(1)
        mutations.createReroute(rootGraphId, rerouteId, { x: 10, y: 10 })
        mutations.deleteReroute(rootGraphId, rerouteId)
        expect(mutations.deleteReroute(rootGraphId, rerouteId)).toBe('no-op')
        expect(layoutStore.getRerouteLayout(rootGraphId, rerouteId)).toBeNull()
      }
    }
  )
})
