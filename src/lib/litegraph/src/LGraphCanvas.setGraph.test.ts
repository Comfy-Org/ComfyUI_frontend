import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

function createCanvasWithSelectedNode() {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
  const node = new LGraphNode('Selected')
  graph.add(node)
  canvas.select(node)
  const selectionSizeAtAnnouncement: number[] = []
  canvasElement.addEventListener('litegraph:set-graph', () => {
    selectionSizeAtAnnouncement.push(canvas.selectedItems.size)
  })
  return { canvas, graph, selectionSizeAtAnnouncement }
}

describe('LGraphCanvas graph replacement', () => {
  it('announces the new graph before clearing the outgoing selection', () => {
    const { canvas, selectionSizeAtAnnouncement } =
      createCanvasWithSelectedNode()

    canvas.setGraph(new LGraph())

    expect(selectionSizeAtAnnouncement).toEqual([1])
    expect(canvas.selectedItems.size).toBe(0)
  })

  it('announces an opened subgraph before clearing the outgoing selection', () => {
    const { canvas, graph, selectionSizeAtAnnouncement } =
      createCanvasWithSelectedNode()
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const subgraphNode = createTestSubgraphNode(subgraph)

    canvas.openSubgraph(subgraph, subgraphNode)

    expect(selectionSizeAtAnnouncement[0]).toBe(1)
    expect(canvas.graph).toBe(subgraph)
    expect(canvas.selectedItems.size).toBe(0)
  })
})
