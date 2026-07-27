import { afterEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { canvasNodeTarget, canvasTransformValid } from './canvasCoachTarget'

interface FakeCanvas {
  graph: LGraph
  ds: DragAndScale
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

/** The real camera, so the target maps through the same maths the canvas does. */
function makeDs(offset: [number, number] = [10, 20], scale = 2): DragAndScale {
  const ds = new DragAndScale(document.createElement('canvas'))
  ds.offset = offset
  ds.scale = scale
  return ds
}

function mountCanvas(ds: DragAndScale = makeDs()): LGraph {
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

  it('validates the camera transform', () => {
    expect(canvasTransformValid()).toBe(false)

    mountCanvas(makeDs([Number.NaN, 0], 1))
    expect(canvasTransformValid()).toBe(false)

    mountCanvas(makeDs([0, 0], 0))
    expect(canvasTransformValid()).toBe(false)

    mountCanvas()
    expect(canvasTransformValid()).toBe(true)
  })
})
