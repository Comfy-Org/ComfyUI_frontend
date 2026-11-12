import { describe, expect, it, onTestFinished } from 'vitest'

import {
  LGraphNode,
  LinkConnector,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

describe('renderer socket drop targets', () => {
  it('creates a subgraph input when its target socket lies outside the node body', () => {
    const graph = createTestSubgraph()
    graph.inputNode.pos = [-500, -500]
    const node = new LGraphNode('Target')
    graph.add(node)
    node.pos = [100, 200]
    const input = node.addInput('value', 'STRING')
    input.pos = [-10, 20]
    node.updateArea()
    const [x, y] = node.getInputPos(0)
    expect(graph.getNodeOnPos(x, y)).toBeNull()
    LiteGraph.vueNodesMode = true
    onTestFinished(() => {
      LiteGraph.vueNodesMode = false
    })
    const connector = new LinkConnector(() => {})
    connector.dragNewFromSubgraphInput(
      graph,
      graph.inputNode,
      graph.inputNode.emptySlot
    )
    const event = Object.assign(new PointerEvent('pointerup'), {
      canvasX: x,
      canvasY: y,
      deltaX: 0,
      deltaY: 0,
      safeOffsetX: x,
      safeOffsetY: y
    })

    connector.dropLinks(graph, event)

    expect(graph.inputs.map((slot) => slot.name)).toEqual(['value'])
    expect(input.link).not.toBeNull()
    expect(graph.links.size).toBe(1)
  })
})
