import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Rect } from './interfaces'
import { LGraph, LGraphNode, LiteGraph } from './litegraph'
import { resizeNodeLayout } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'

describe('layout geometry projection', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
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
    layoutStore.reportContentSize(graph.rootGraph.id, node.id, {
      width: 123,
      height: 30
    })

    expect(node.width).toBe(123)
    expect(node.getConnectionPos(false, 0)[0]).toBe(node.pos[0] + 123)
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

  test('keeps measured geometry separate from requested size', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.size = [100, 50]
    graph.add(node)
    layoutStore.reportContentSize(graph.rootGraph.id, node.id, {
      width: 225,
      height: 80
    })

    expect([...node.size]).toEqual([100, 50])
    expect(node.serialize().size).toEqual([100, 50])
    node.setSize([node.size[0] + 90, node.size[1] + 100])
    expect([...node.renderingSize]).toEqual([225, 150])
    const bounds: Rect = [0, 0, 0, 0]
    node.measure(bounds)
    expect(bounds).toEqual([
      node.pos[0],
      node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
      225,
      150 + LiteGraph.NODE_TITLE_HEIGHT
    ])
    expect(node.serialize().size).toEqual([190, 150])
  })

  test('uses the attached graph for geometry and measured content', () => {
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
    expect([...node.renderingSize]).toEqual([225, 90])
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
