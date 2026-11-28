import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'
import { LGraph, LGraphNode, LiteGraph } from './litegraph'
import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { bindMountedNodeSize } from '@/renderer/core/layout/store/mountedNodeSizes'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

describe('layout geometry projection', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  test('configure commits the saved position and size once each', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.pos = [10, 10]
    node.size = [140, 80]
    const moves: unknown[] = []
    const resizes: unknown[] = []
    const stop = layoutStore.onChange(({ operation }) => {
      if (operation.type === 'moveNode') moves.push(operation.position)
      if (operation.type === 'resizeNode') resizes.push(operation.size)
    })

    node.configure({ ...node.serialize(), pos: [300, 400], size: [220, 160] })
    await Promise.resolve()
    stop()

    expect(moves).toEqual([{ x: 300, y: 400 }])
    expect(resizes).toEqual([{ width: 220, height: 160 }])
  })

  test('applies a resize and position change through one attached update', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const batchUpdateNodeBounds = vi.spyOn(layoutStore, 'batchUpdateNodeBounds')

    resizeNodeLayout(
      node,
      { width: 300, height: 120 },
      {
        position: { x: 40, y: 60 },
        source: LayoutSource.Vue
      }
    )

    expect(batchUpdateNodeBounds).toHaveBeenCalledOnce()
    expect(batchUpdateNodeBounds).toHaveBeenCalledWith(
      graph.rootGraph.id,
      [{ nodeId: node.id, bounds: { x: 40, y: 60, width: 300, height: 120 } }],
      { source: LayoutSource.Vue }
    )
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toMatchObject({
      position: { x: 40, y: 60 },
      size: { width: 300, height: 120 }
    })
  })

  test('uses measured collapsed width for node and connection geometry', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.flags.collapsed = true
    bindMountedNodeSize(graph, node.id, () => {}).report(
      {
        width: 123,
        height: 30
      },
      true
    )

    const previousMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    try {
      expect(node.width).toBe(123)
      expect(node.getConnectionPos(false, 0)[0]).toBe(node.pos[0] + 123)
    } finally {
      LiteGraph.vueNodesMode = previousMode
    }
  })

  test('moves from the latest stored position', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40)
    node.move(5, 10)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 35, y: 50 })
  })

  test('snaps the latest stored position', () => {
    const { graph, node } = nodeWithStoredBounds(103, 97)
    node.snapToGrid(20)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 100, y: 100 })
  })

  test('preserves stored geometry when removed and re-added', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40)
    graph.remove(node)
    graph.add(node)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toMatchObject({
      position: { x: 30, y: 40 },
      size: { width: 200, height: 80 }
    })
  })

  test('keeps detached setPos and setSize writes local', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40)
    const graphId = graph.rootGraph.id
    const nodeId = node.id
    graph.remove(node)

    node.setPos(70, 90)
    node.setSize([320, 180])

    expect([...node.pos]).toEqual([70, 90])
    expect([...node.size]).toEqual([320, 180])
    expect(layoutStore.getNodeLayout(graphId, nodeId)).toBeNull()
    expect(graph.getNodeById(nodeId)).toBeNull()
  })

  test('refreshes stable views before indexed mutations', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40, true)
    const pos = node.pos
    const size = node.size
    pos[0] = 50
    size[1] = 90

    expect(node.pos).toBe(pos)
    expect(node.size).toBe(size)
    expect([...pos]).toEqual([50, 40])
    expect([...size]).toEqual([200, 90])
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toMatchObject({
      position: { x: 50, y: 40 },
      size: { width: 200, height: 90 }
    })
  })

  test('keeps legacy buffers and views stable across store updates', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const pos = node.pos
    const size = node.size
    const posBuffer = node._pos
    const sizeBuffer = node._size
    updateBounds(graph, node, 30, 40)

    expect([...node.pos]).toEqual([30, 40])
    expect([...node.size]).toEqual([200, 80])
    expect(node.pos).toBe(pos)
    expect(node.size).toBe(size)
    expect(node._pos).toBe(posBuffer)
    expect(node._size).toBe(sizeBuffer)
  })

  test('reads stored geometry once per layout revision', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40)
    void node.renderingSize
    const readNodeRect = vi.spyOn(layoutStore, 'readNodeRect')

    void node.pos[0]
    void node.size[0]
    void node.renderingSize[0]
    expect(readNodeRect).not.toHaveBeenCalled()

    updateBounds(graph, node, 50, 60)
    expect([...node.pos]).toEqual([50, 60])
    expect([...node.size]).toEqual([200, 80])
    expect([...node.renderingSize]).toEqual([200, 80])
    expect(readNodeRect).toHaveBeenCalledOnce()
  })

  test('preserves stored size when assigning position', () => {
    const { node } = nodeWithStoredBounds(30, 40, true)
    node.pos = [50, 60]
    expect([...node.size]).toEqual([200, 80])
  })

  test('preserves stored position when assigning size', () => {
    const { node } = nodeWithStoredBounds(30, 40, true)
    node.size = [300, 90]
    expect([...node.pos]).toEqual([30, 40])
  })

  test('does not write a stale width back to the store', () => {
    const { graph, node } = nodeWithStoredBounds(30, 40, true)
    node.pos = [50, 60]
    node.setSize([node.size[0], 120])
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toMatchObject({
      position: { x: 50, y: 60 },
      size: { width: 200, height: 120 }
    })
  })

  test('keeps clamped geometry after a size request that does not resize the DOM', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.size = [100, 50]
    graph.add(node)
    bindMountedNodeSize(graph, node.id, () => {}).report(
      { width: 225, height: 100 },
      false
    )

    const previousMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    try {
      node.setSize([200, 100])
      const bounds: Rect = [0, 0, 0, 0]
      node.measure(bounds)
      expect(bounds[2]).toBe(225)
      expect(node.serialize().size).toEqual([200, 100])
    } finally {
      LiteGraph.vueNodesMode = previousMode
    }
  })

  test('writes requested dimensions to the attached graph', () => {
    const attachedGraph = new LGraph()
    const currentGraph = new LGraph()
    const node = new LGraphNode('attached')
    const decoy = new LGraphNode('decoy')
    node.id = toNodeId(1)
    decoy.id = node.id
    attachedGraph.add(node)
    currentGraph.add(decoy)
    node.graph = currentGraph
    decoy.pos = [30, 40]
    decoy.size = [200, 80]
    layoutStore.reportContentSize(attachedGraph.id, node.id, {
      width: 225,
      height: 90
    })

    node.pos = [30, 40]
    node.size = [200, 80]

    expect(
      layoutStore.getNodeLayoutRef(attachedGraph.id, node.id).value
    ).toMatchObject({
      position: { x: 30, y: 40 },
      size: { width: 200, height: 80 }
    })
    expect([...node.renderingSize]).toEqual([200, 80])
  })
})

function nodeWithStoredBounds(x: number, y: number, initialize = false) {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  if (initialize) {
    node.pos = [10, 20]
    node.size = [100, 50]
  }
  graph.add(node)
  updateBounds(graph, node, x, y)
  return { graph, node }
}

function updateBounds(graph: LGraph, node: LGraphNode, x: number, y: number) {
  layoutStore.batchUpdateNodeBounds(
    graph.rootGraph.id,
    [{ nodeId: node.id, bounds: { x, y, width: 200, height: 80 } }],
    { source: LayoutSource.Canvas }
  )
}

describe('boundingRect after a move', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  test.for<{ name: string; move: (graph: LGraph, node: LGraphNode) => void }>([
    {
      name: 'the pos setter',
      move: (_graph, node) => {
        node.pos = [140, 260]
      }
    },
    {
      name: 'the layout store',
      move: (graph, node) => {
        layoutStore.batchUpdateNodeBounds(
          graph.rootGraph.id,
          [
            {
              nodeId: node.id,
              bounds: { x: 140, y: 260, width: 100, height: 50 }
            }
          ],
          { source: LayoutSource.Vue }
        )
      }
    }
  ])(
    'follows a move through $name before the next measure, keeping onBounding growth',
    ({ move }) => {
      const graph = new LGraph()
      const node = new LGraphNode('test')
      graph.add(node)
      node.pos = [40, 60]
      node.size = [100, 50]
      node.onBounding = (bounds) => {
        bounds[0] -= 10
        bounds[3] += 20
      }
      node.updateArea()

      move(graph, node)

      expect([...node.boundingRect]).toEqual([
        130,
        260 - LiteGraph.NODE_TITLE_HEIGHT,
        100,
        50 + LiteGraph.NODE_TITLE_HEIGHT + 20
      ])
    }
  )
})

test('an onBounding hook that reads boundingRect sees the fresh measurement', () => {
  layoutStore.resetForTests()
  const graph = new LGraph()
  const node = new LGraphNode('test')
  graph.add(node)
  node.pos = [40, 60]
  node.size = [100, 50]
  node.onBounding = (bounds) => {
    bounds[3] = node.boundingRect[3] + 20
  }
  node.updateArea()
  node.pos = [140, 260]

  node.updateArea()

  expect([...node.boundingRect]).toEqual([
    140,
    260 - LiteGraph.NODE_TITLE_HEIGHT,
    100,
    50 + LiteGraph.NODE_TITLE_HEIGHT + 20
  ])
})
