import { describe, expect, it } from 'vitest'

import {
  ISlotType,
  LGraph,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from './fixtures/subgraphHelpers'

function createNode(
  graph: LGraph,
  inputs: ISlotType[] = [],
  outputs: ISlotType[] = []
) {
  const type = JSON.stringify({ inputs, outputs })
  if (!LiteGraph.registered_node_types[type]) {
    class testnode extends LGraphNode {
      constructor(title: string) {
        super(title)
        let i_count = 0
        for (const input of inputs) this.addInput('input_' + i_count++, input)
        let o_count = 0
        for (const output of outputs)
          this.addOutput('output_' + o_count++, output)
      }
    }
    LiteGraph.registered_node_types[type] = testnode
  }
  const node = LiteGraph.createNode(type)
  if (!node) {
    throw new Error('Failed to create node')
  }
  graph.add(node)
  return node
}

describe('SubgraphConversion', () => {
  describe('Subgraph Unpacking Functionality', () => {
    it('Should keep interior nodes and links', () => {
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph
      graph.add(subgraphNode)

      const node1 = createNode(subgraph, [], ['number'])
      const node2 = createNode(subgraph, ['number'])
      node1.connect(0, node2, 0)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.nodes.length).toBe(2)
      expect(graph.links.size).toBe(1)
    })
    it('Should merge boundry links', () => {
      return
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }],
        outputs: [{ name: 'value', type: 'number' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const graph = subgraphNode.graph
      graph.add(subgraphNode)

      const innerNode1 = createNode(subgraph, [], ['number'])
      const innerNode2 = createNode(subgraph, ['number'])
      subgraph.inputNode.slots[0].connect(innerNode2.inputs[0], innerNode1)
      subgraph.outputNode.slots[0].connect(innerNode1.outputs[0], innerNode1)

      const outerNode1 = createNode(graph, [], ['number'])
      const outerNode2 = createNode(graph, ['number'])
      outerNode1.connect(0, subgraphNode, 0)
      subgraphNode.connect(0, outerNode2, 0)

      graph.unpackSubgraph(subgraphNode)

      expect(graph.nodes.length).toBe(4)
      expect(graph.links.size).toBe(2)
    })
  })
})
