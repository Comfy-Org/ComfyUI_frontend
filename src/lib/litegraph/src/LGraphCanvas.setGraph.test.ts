import { describe, expect, it, vi } from 'vitest'

import type { SelectableKey } from '@/core/selection/selectionState'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { selectableKeyOf } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

interface Announcement {
  oldGraph: LGraph | Subgraph | null | undefined
  newGraph: LGraph | Subgraph
  attachedGraph: LGraph | null
  selectionSize: number
  savedOutgoingKeys: readonly SelectableKey[]
}

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
  const announcements: Announcement[] = []
  canvas.canvas.addEventListener<'litegraph:set-graph'>(
    'litegraph:set-graph',
    (event) => {
      announcements.push({
        oldGraph: event.detail.oldGraph,
        newGraph: event.detail.newGraph,
        attachedGraph: canvas.graph,
        selectionSize: canvas.selectedItems.size,
        savedOutgoingKeys: useSelectionStore().selectedKeys(graphScopeOf(graph))
      })
    }
  )
  return { canvas, graph, node, announcements }
}

describe('LGraphCanvas graph replacement', () => {
  const replacements = [
    {
      name: 'setGraph() to a root graph',
      target: (_graph: LGraph) => new LGraph(),
      replace: (canvas: LGraphCanvas, target: LGraph | Subgraph) =>
        canvas.setGraph(target)
    },
    {
      name: 'setGraph() to a subgraph',
      target: (graph: LGraph) => createTestSubgraph({ rootGraph: graph }),
      replace: (canvas: LGraphCanvas, target: LGraph | Subgraph) =>
        canvas.setGraph(target)
    },
    {
      name: 'openSubgraph()',
      target: (graph: LGraph) => createTestSubgraph({ rootGraph: graph }),
      replace: (canvas: LGraphCanvas, target: LGraph | Subgraph) => {
        if (!('inputNode' in target)) throw new Error('expected a subgraph')
        canvas.openSubgraph(target, createTestSubgraphNode(target))
      }
    }
  ]

  it.for(replacements)(
    '$name announces the attached new graph once, with the outgoing items released and their scope still saved',
    ({ target, replace }) => {
      const { canvas, graph, node, announcements } =
        createCanvasWithSelectedNode()
      const newGraph = target(graph)

      replace(canvas, newGraph)

      expect(announcements).toHaveLength(1)
      expect(announcements[0].oldGraph).toBe(graph)
      expect(announcements[0].newGraph).toBe(newGraph)
      expect(announcements[0].attachedGraph).toBe(newGraph)
      expect(announcements[0].selectionSize).toBe(0)
      expect(announcements[0].savedOutgoingKeys).toEqual([
        selectableKeyOf(node)
      ])
      expect(canvas.graph).toBe(newGraph)
      expect(canvas.selectedItems.size).toBe(0)
      expect(useSelectionStore().selectedKeys(graphScopeOf(graph))).toEqual([])
    }
  )

  it('records the opened subgraph on the canvas', () => {
    const { canvas, graph } = createCanvasWithSelectedNode()
    const subgraph = createTestSubgraph({ rootGraph: graph })

    canvas.openSubgraph(subgraph, createTestSubgraphNode(subgraph))

    expect(canvas.subgraph).toBe(subgraph)
  })

  it.for([
    { name: 'with no listener', deselectDuringEvent: false },
    {
      name: 'when a listener deselects during the announcement',
      deselectDuringEvent: true
    }
  ])(
    'drops the outgoing selection and keeps the incoming graph selection $name',
    ({ deselectDuringEvent }) => {
      const { canvas, graph, node } = createCanvasWithSelectedNode()
      const newGraph = new LGraph()
      const incoming = new LGraphNode('Incoming')
      newGraph.add(incoming)
      useSelectionStore().apply(graphScopeOf(newGraph), {
        type: 'selection.add',
        key: selectableKeyOf(incoming)
      })
      if (deselectDuringEvent)
        canvas.canvas.addEventListener('litegraph:set-graph', () =>
          canvas.deselectAll()
        )

      canvas.setGraph(newGraph)

      expect(useSelectionStore().selectedKeys(graphScopeOf(graph))).toEqual([])
      expect(useSelectionStore().selectedKeys(graphScopeOf(newGraph))).toEqual([
        selectableKeyOf(incoming)
      ])
      expect(node.selected).toBeFalsy()
      expect(canvas.selectedItems.size).toBe(0)
    }
  )
})
