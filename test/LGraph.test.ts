import { LGraph, LGraphGroup, LGraphNode, LiteGraph } from '../src/litegraph'
import { LiteGraphGlobal } from '../src/LiteGraphGlobal'

function makeGraph() {
  const LiteGraph = new LiteGraphGlobal()
  LiteGraph.registerNodeType('TestNode', LGraphNode)
  LiteGraph.registerNodeType('OtherNode', LGraphNode)
  LiteGraph.registerNodeType('', LGraphNode)
  return new LGraph()
}

describe('LGraph', () => {
  it('can be instantiated', () => {
    // @ts-ignore TODO: Remove once relative imports fix goes in.
    const graph = new LGraph({ extra: 'TestGraph' })
    expect(graph).toBeInstanceOf(LGraph)
    expect(graph.extra).toBe('TestGraph')
  })
})

describe('Legacy LGraph Compatibility Layer', () => {
  it('can be extended via prototype', () => {
    const graph = new LGraph()
    // @ts-expect-error Should always be an error.
    LGraph.prototype.newMethod = function () {
      return 'New method added via prototype'
    }
    // @ts-expect-error Should always be an error.
    expect(graph.newMethod()).toBe('New method added via prototype')
  })

  it('is correctly assigned to LiteGraph', () => {
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})

describe('LGraph Serialisation', () => {
  it('should serialise', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('Test Node'))
    graph.add(new LGraphGroup('Test Group'))
    expect(graph.nodes.length).toBe(1)
    expect(graph.groups.length).toBe(1)
  })
})
