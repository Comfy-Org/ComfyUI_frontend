import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import {
  canvasNodeTarget,
  canvasNodesRect,
  canvasTransformValid
} from './canvasCoachTarget'

interface FakeCanvas {
  graph: LGraph
  ds: { offset: [number, number]; scale: number }
  canvas: { getBoundingClientRect: () => DOMRect }
}

const appState = vi.hoisted(() => ({ canvas: undefined as unknown }))

vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return appState.canvas
    }
  }
}))

function mountCanvas(
  ds: FakeCanvas['ds'] = { offset: [10, 20], scale: 2 }
): LGraph {
  const graph = new LGraph()
  appState.canvas = {
    graph,
    ds,
    canvas: { getBoundingClientRect: () => new DOMRect(5, 7, 800, 600) }
  } satisfies FakeCanvas
  return graph
}

function addNode(
  graph: LGraph,
  pos: [number, number],
  size: [number, number]
): LGraphNode {
  const node = new LGraphNode('node')
  node.pos = pos
  node.size = size
  graph.add(node)
  node.updateArea()
  return node
}

describe('canvasCoachTarget', () => {
  afterEach(() => {
    appState.canvas = undefined
  })

  it('maps a node through the camera transform, including its title bar', () => {
    const graph = mountCanvas()
    const node = addNode(graph, [100, 200], [50, 60])
    const title = LiteGraph.NODE_TITLE_HEIGHT

    const rect = canvasNodeTarget(node.id).getBoundingClientRect()

    expect(rect.x).toBe((100 + 10) * 2 + 5)
    expect(rect.y).toBe((200 - title + 20) * 2 + 7)
    expect(rect.width).toBe(50 * 2)
    expect(rect.height).toBe((60 + title) * 2)
  })

  it('reports a zero-sized rect for an unknown node, so it is not laid out', () => {
    mountCanvas()
    const rect = canvasNodeTarget(toNodeId('missing')).getBoundingClientRect()
    expect(rect.width).toBe(0)
    expect(rect.height).toBe(0)
  })

  it('reports a zero-sized rect for a node the render loop has not measured', () => {
    const graph = mountCanvas()
    const node = new LGraphNode('node')
    node.pos = [100, 200]
    node.size = [50, 60]
    graph.add(node)
    expect(canvasNodeTarget(node.id).getBoundingClientRect().width).toBe(0)
  })

  it('reports a zero-sized rect while no canvas exists', () => {
    const rect = canvasNodeTarget(toNodeId(1)).getBoundingClientRect()
    expect(rect.width).toBe(0)
  })

  it('unions the rects of resolvable nodes and skips unknown ids', () => {
    const graph = mountCanvas({ offset: [0, 0], scale: 1 })
    const a = addNode(graph, [0, 100], [10, 10])
    const b = addNode(graph, [200, 300], [40, 20])
    const title = LiteGraph.NODE_TITLE_HEIGHT

    const rect = canvasNodesRect([a.id, b.id, toNodeId('missing')])

    expect(rect).not.toBeNull()
    expect(rect?.left).toBe(5)
    expect(rect?.top).toBe(100 - title + 7)
    expect(rect?.right).toBe(240 + 5)
    expect(rect?.bottom).toBe(320 + 7)
  })

  it('returns null when no node resolves', () => {
    mountCanvas()
    expect(canvasNodesRect([toNodeId('missing')])).toBeNull()
  })

  it('validates the camera transform', () => {
    expect(canvasTransformValid()).toBe(false)

    mountCanvas({ offset: [Number.NaN, 0], scale: 1 })
    expect(canvasTransformValid()).toBe(false)

    mountCanvas({ offset: [0, 0], scale: 0 })
    expect(canvasTransformValid()).toBe(false)

    mountCanvas()
    expect(canvasTransformValid()).toBe(true)
  })
})
