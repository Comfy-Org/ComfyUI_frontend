import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  setupComplexPromotionFixture
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { app } from '@/scripts/app'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import { widgetHistoryScope } from './widgetHistoryScope'

vi.mock(import('@/scripts/app'))

const CANVAS_GRAPH_ID = '00000000-0000-4000-8000-0000000000c1'

describe(widgetHistoryScope, () => {
  it('keys a root graph widget by the root graph', () => {
    const id = registerTestWidget({
      name: 'curve',
      nodeId: toNodeId(3),
      value: null
    })

    expect(widgetHistoryScope(id)).toEqual({
      rootGraphId: app.rootGraph.id,
      widgetId: widgetId(app.rootGraph.id, toNodeId(3), 'curve')
    })
  })

  it('keys a subgraph widget by its subgraph while the canvas shows another graph', () => {
    const subgraph = createTestSubgraph()
    subgraph.rootGraph.subgraphs.set(subgraph.id, subgraph)
    vi.mocked(app).rootGraph = subgraph.rootGraph
    app.canvas.graph = fromPartial({ id: CANVAS_GRAPH_ID })
    const interior = new LGraphNode('Interior')
    interior.addWidget('number', 'curve', 0, () => {})
    subgraph.add(interior)

    const scope = widgetHistoryScope(
      widgetId(subgraph.rootGraph.id, interior.id, 'curve')
    )

    expect(scope).toEqual({
      rootGraphId: subgraph.rootGraph.id,
      widgetId: widgetId(subgraph.id, interior.id, 'curve')
    })
  })

  it('has no scope for a widget in an unknown subgraph', () => {
    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()
    vi.mocked(app).rootGraph = graph
    graph.subgraphs.delete(subgraph.id)
    const id = hostNode.widgets[0]?.widgetId ?? hostNode.inputs[0]?.widgetId
    assert.exists(id)

    expect(widgetHistoryScope(id)).toBeNull()
  })

  it('falls back to the canvas graph and the given node without a locator', () => {
    app.canvas.graph = fromPartial({ id: CANVAS_GRAPH_ID })
    const id = registerTestWidget({
      name: 'curve',
      nodeId: toNodeId('9:5'),
      value: null
    })

    expect(widgetHistoryScope(id, toNodeId(5))).toEqual({
      rootGraphId: app.rootGraph.id,
      widgetId: widgetId(CANVAS_GRAPH_ID, toNodeId(5), 'curve')
    })
  })

  it('has no scope without a locator or a fallback node', () => {
    const id = registerTestWidget({
      name: 'curve',
      nodeId: toNodeId('9:5'),
      value: null
    })

    expect(widgetHistoryScope(id)).toBeNull()
  })
})
