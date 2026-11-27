import { expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { deserialiseIntoGraphWithSourceIndices } from './vintageClipboard'

class VintageSource extends LGraphNode {
  constructor() {
    super('Vintage source')
    this.addOutput('value', '*')
  }
}

class VintageSink extends LGraphNode {
  constructor() {
    super('Vintage sink')
    this.addInput('value', '*')
  }
}

it('keeps clipboard indices stable when a target graph refuses a node', () => {
  const sourceType = 'test/vintage-source'
  const sinkType = 'test/vintage-sink'
  const missingType = 'test/vintage-missing-subgraph'
  LiteGraph.registerNodeType(sourceType, VintageSource)
  LiteGraph.registerNodeType(sinkType, VintageSink)
  vi.mocked(console.warn).mockImplementation(() => {})
  const graph = new LGraph()
  const node = (id: number, type: string, x: number) => ({
    id,
    type,
    pos: [x, 0],
    size: [100, 80],
    flags: {},
    order: id,
    mode: 0
  })

  const { createdNodes, nodesBySourceIndex } =
    deserialiseIntoGraphWithSourceIndices(
      JSON.stringify({
        nodes: [
          node(0, sourceType, 0),
          node(1, missingType, 120),
          node(2, sinkType, 240)
        ],
        links: [
          [0, 0, 2, 0, '*'],
          [0, 0, 1, 0, '*'],
          [1, 0, 2, 0, '*']
        ]
      }),
      graph,
      [0, 0]
    )

  expect(nodesBySourceIndex.map((node) => node?.type ?? null)).toEqual([
    sourceType,
    null,
    sinkType
  ])
  expect(createdNodes.map(({ type }) => type)).toEqual([sourceType, sinkType])

  const [sourceNode, sinkNode] = createdNodes
  expect(graph.links.size).toBe(1)
  const [survivingLink] = graph.links.values()
  expect(survivingLink.origin_id).toBe(sourceNode.id)
  expect(survivingLink.origin_slot).toBe(0)
  expect(survivingLink.target_id).toBe(sinkNode.id)
  expect(survivingLink.target_slot).toBe(0)
})

it('requires every clipboard member before running any available constructor', () => {
  const availableType = 'test/vintage-available'
  const missingType = 'test/vintage-unavailable-middle'
  const constructed = vi.fn()
  class AvailableNode extends LGraphNode {
    constructor() {
      super('Clipboard test')
      constructed()
    }
  }
  LiteGraph.registerNodeType(availableType, AvailableNode)
  const graph = new LGraph()
  graph.add(new VintageSource())
  const before = graph.serialize()

  const result = deserialiseIntoGraphWithSourceIndices(
    JSON.stringify({
      nodes: [
        { type: availableType, pos: [0, 0] },
        { type: missingType, pos: [120, 0] },
        { type: availableType, pos: [240, 0] }
      ],
      links: []
    }),
    graph,
    [0, 0],
    { requireAll: true }
  )

  expect(constructed).not.toHaveBeenCalled()
  expect(result).toEqual({
    createdNodes: [],
    nodesBySourceIndex: [null, null, null],
    failure: {
      sourceIndex: 1,
      result: { kind: 'refused', reason: 'unregistered', type: missingType }
    }
  })
  expect(graph.serialize()).toEqual(before)
})

it('abandons a required batch when a later constructor replaces an earlier registration', () => {
  const sourceType = 'test/vintage-replaced'
  const replacingType = 'test/vintage-replacing'
  class ReplacingNode extends LGraphNode {
    constructor() {
      super('Clipboard test')
      LiteGraph.registerNodeType(sourceType, VintageSink)
    }
  }
  LiteGraph.registerNodeType(sourceType, VintageSource)
  LiteGraph.registerNodeType(replacingType, ReplacingNode)
  const graph = new LGraph()
  graph.add(new VintageSource())
  const before = graph.serialize()

  const result = deserialiseIntoGraphWithSourceIndices(
    JSON.stringify({
      nodes: [
        { type: sourceType, pos: [0, 0] },
        { type: replacingType, pos: [120, 0] }
      ],
      links: []
    }),
    graph,
    [0, 0],
    { requireAll: true }
  )

  expect(result.failure).toEqual({
    sourceIndex: 0,
    result: { kind: 'refused', reason: 'stale-preparation', type: sourceType }
  })
  expect(graph.serialize()).toEqual(before)
})

it('abandons a required batch when configuration invalidates a later construction', () => {
  const replacingType = 'test/vintage-configure-replacing'
  const sourceType = 'test/vintage-configure-replaced'
  class ReplacingOnConfigureNode extends LGraphNode {
    override onConfigure() {
      LiteGraph.registerNodeType(sourceType, VintageSink)
    }
  }
  LiteGraph.registerNodeType(replacingType, ReplacingOnConfigureNode)
  LiteGraph.registerNodeType(sourceType, VintageSource)
  const graph = new LGraph()
  graph.add(new VintageSource())
  const before = graph.serialize()

  const result = deserialiseIntoGraphWithSourceIndices(
    JSON.stringify({
      nodes: [
        { type: replacingType, pos: [0, 0] },
        { type: sourceType, pos: [120, 0] }
      ],
      links: []
    }),
    graph,
    [0, 0],
    { requireAll: true }
  )

  expect(result.failure).toEqual({
    sourceIndex: 1,
    result: {
      kind: 'refused',
      reason: 'stale-preparation',
      type: sourceType
    }
  })
  expect(graph.serialize()).toEqual(before)
})

it('preserves the existing graph when a later required constructor throws', () => {
  const availableType = 'test/vintage-before-throw'
  const throwingType = 'test/vintage-throwing'
  const cause = new Error('clipboard constructor failed')
  class ThrowingNode extends LGraphNode {
    constructor() {
      super('Clipboard test')
      throw cause
    }
  }
  LiteGraph.registerNodeType(availableType, VintageSource)
  LiteGraph.registerNodeType(throwingType, ThrowingNode)
  const graph = new LGraph()
  const source = new VintageSource()
  const sink = new VintageSink()
  graph.add(source)
  graph.add(sink)
  source.connect(0, sink, 0)
  const before = graph.serialize()

  const result = deserialiseIntoGraphWithSourceIndices(
    JSON.stringify({
      nodes: [
        { type: availableType, pos: [0, 0] },
        { type: throwingType, pos: [120, 0] }
      ],
      links: []
    }),
    graph,
    [0, 0],
    { requireAll: true }
  )

  expect(result).toEqual({
    createdNodes: [],
    nodesBySourceIndex: [null, null],
    failure: {
      sourceIndex: 1,
      result: { kind: 'failed', phase: 'constructor', cause }
    }
  })
  expect(graph.serialize()).toEqual(before)
})
