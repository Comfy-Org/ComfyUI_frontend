import { expect, it, onTestFinished, vi } from 'vitest'

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
  onTestFinished(() => {
    delete LiteGraph.registered_node_types[sourceType]
    delete LiteGraph.registered_node_types[sinkType]
  })
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
