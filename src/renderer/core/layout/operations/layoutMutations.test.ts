import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

import { useLayoutMutations } from './layoutMutations'

const GRAPH = createUuidv4()
const NODE_1 = toNodeId('1')
const NODE_2 = toNodeId('2')
const MISSING_NODE = toNodeId('999')
function seedNode(
  nodeId: NodeId,
  [x, y]: [number, number],
  [width, height]: [number, number],
  zIndex: number
) {
  layoutStore.applyOperation({
    type: 'createNode',
    graphId: GRAPH,
    nodeId,
    layout: {
      id: nodeId,
      position: { x, y },
      size: { width, height },
      zIndex,
      visible: true,
      bounds: { x, y, width, height }
    },
    timestamp: Date.now(),
    source: LayoutSource.Canvas
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  seedNode(NODE_1, [10, 20], [200, 100], 0)
  seedNode(NODE_2, [300, 400], [150, 80], 1)
})

describe('moveNode', () => {
  it('does nothing when node does not exist', () => {
    const { moveNode } = useLayoutMutations(LayoutSource.Canvas)
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    moveNode(GRAPH, MISSING_NODE, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates node position', () => {
    const { moveNode } = useLayoutMutations(LayoutSource.Canvas)
    moveNode(GRAPH, NODE_1, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.position).toEqual(
      {
        x: 100,
        y: 200
      }
    )
  })
})

describe('setNodeZIndex', () => {
  it('does nothing when node does not exist', () => {
    const { setNodeZIndex } = useLayoutMutations(LayoutSource.Canvas)
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    setNodeZIndex(GRAPH, MISSING_NODE, 10)
    expect(layoutStore.getNodeLayoutRef(GRAPH, MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates node z-index', () => {
    const { setNodeZIndex } = useLayoutMutations(LayoutSource.Canvas)
    setNodeZIndex(GRAPH, NODE_1, 42)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex).toBe(42)
  })
})

describe('batchMoveNodes', () => {
  it('does nothing when updates array is empty', () => {
    const { batchMoveNodes } = useLayoutMutations(LayoutSource.Canvas)
    const before1 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value }
    batchMoveNodes(GRAPH, [])
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value).toEqual(before2)
  })

  it('updates positions for all found nodes', () => {
    const { batchMoveNodes } = useLayoutMutations(LayoutSource.Canvas)
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
    const { batchMoveNodes } = useLayoutMutations(LayoutSource.Canvas)
    batchMoveNodes(GRAPH, [{ nodeId: NODE_1, position: { x: 50, y: 60 } }])
    expect(layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.size).toEqual({
      width: 200,
      height: 100
    })
  })

  it('skips nodes not found in the store', () => {
    const { batchMoveNodes } = useLayoutMutations(LayoutSource.Canvas)
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

  it('reports the source it was built with, not the batch transport', async () => {
    const sources: LayoutSource[] = []
    const stop = layoutStore.onChange(({ source }) => sources.push(source))
    onTestFinished(stop)

    useLayoutMutations(LayoutSource.Canvas).batchMoveNodes(GRAPH, [
      { nodeId: NODE_1, position: { x: 50, y: 60 } }
    ])
    await vi.waitFor(() => expect(sources).not.toHaveLength(0))

    expect(sources).toEqual([LayoutSource.Canvas])
  })
})

describe('bringNodeToFront', () => {
  it('gives the node a higher z-index than all other nodes', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations(
      LayoutSource.Canvas
    )
    setNodeZIndex(GRAPH, NODE_2, 10)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('gives the node a higher z-index when all nodes start at the same level', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations(
      LayoutSource.Canvas
    )
    setNodeZIndex(GRAPH, NODE_1, 5)
    setNodeZIndex(GRAPH, NODE_2, 5)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('remains frontmost when the already-leading node is brought to front again', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations(
      LayoutSource.Canvas
    )
    setNodeZIndex(GRAPH, NODE_1, 20)
    setNodeZIndex(GRAPH, NODE_2, 5)
    bringNodeToFront(GRAPH, NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(GRAPH, NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(GRAPH, NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})

describe('setNodeOrder', () => {
  it('does not update a node owned by a sibling graph', () => {
    const root = new LGraph()
    root.add(new LGraphNode('root'))
    const sibling = createTestSubgraph({ rootGraph: root })
    const siblingNode = sibling.add(new LGraphNode('sibling'))!
    const before = layoutStore.getNodeLayout(root.id, siblingNode.id)?.zIndex
    expect(before).toBeTypeOf('number')

    useLayoutMutations(LayoutSource.Canvas).setNodeOrder(
      root,
      siblingNode.id,
      'front'
    )

    expect(layoutStore.getNodeLayout(root.id, siblingNode.id)?.zIndex).toBe(
      before
    )
  })

  it('does not reorder legacy nodes when the target layout is missing', () => {
    const graph = new LGraph()
    const first = graph.add(new LGraphNode('first'))!
    const second = graph.add(new LGraphNode('second'))!
    layoutStore.applyOperation({
      type: 'deleteNode',
      graphId: graph.id,
      nodeId: first.id,
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    useLayoutMutations(LayoutSource.Canvas).setNodeOrder(
      graph,
      first.id,
      'front'
    )

    expect(graph._nodes).toEqual([first, second])
  })

  it.for([['front'], ['back']] as const)(
    'writes %s order only to the authoritative layout',
    ([order]) => {
      const graph = new LGraph()
      const first = graph.add(new LGraphNode('first'))!
      const second = graph.add(new LGraphNode('second'))!

      useLayoutMutations(LayoutSource.Canvas).setNodeOrder(
        graph,
        first.id,
        order
      )

      expect(graph._nodes).toEqual([first, second])
      const firstZ = layoutStore.getNodeLayout(graph.id, first.id)?.zIndex ?? 0
      const secondZ =
        layoutStore.getNodeLayout(graph.id, second.id)?.zIndex ?? 0
      if (order === 'front') expect(firstZ).toBeGreaterThan(secondZ)
      else expect(firstZ).toBeLessThan(secondZ)
    }
  )
})
