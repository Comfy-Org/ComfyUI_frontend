import { LGraph, LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import { describe, expect, it } from 'vitest'

function swapNodes(nodes: LGraphNode[]) {
  const firstNode = nodes[0]
  const lastNode = nodes[nodes.length - 1]
  nodes[0] = lastNode
  nodes[nodes.length - 1] = firstNode
  return nodes
}

function createGraph(...nodes: LGraphNode[]) {
  const graph = new LGraph()
  nodes.forEach((node) => graph.add(node))
  return graph
}

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

describe('LGraph', () => {
  it('should serialize deterministic node order', async () => {
    LiteGraph.registerNodeType('dummy', DummyNode)
    const node1 = new DummyNode()
    const node2 = new DummyNode()
    const graph = createGraph(node1, node2)

    const result1 = graph.serialize({ sortNodes: true })
    expect(result1.nodes).not.toHaveLength(0)
    graph._nodes = swapNodes(graph.nodes)
    const result2 = graph.serialize({ sortNodes: true })

    expect(result1).toEqual(result2)
  })
})
