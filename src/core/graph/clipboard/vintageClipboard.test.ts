import { expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useSubgraphService } from '@/services/subgraphService'

import { deserialiseIntoGraph } from './vintageClipboard'

vi.mock(import('@/scripts/app'))

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
  LiteGraph.registerNodeType(sourceType, VintageSource)
  LiteGraph.registerNodeType(sinkType, VintageSink)
  vi.mocked(console.warn).mockImplementation(() => {})
  const activeRoot = createTestRootGraph()
  const foreignDefinition = createTestSubgraph().asSerialisable()
  const foreignSubgraph = activeRoot.createSubgraph(foreignDefinition)
  useSubgraphService().registerNewSubgraph(foreignSubgraph, foreignDefinition)
  Reflect.set(app, 'rootGraph', activeRoot)
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

  const createdNodes = deserialiseIntoGraph(
    JSON.stringify({
      nodes: [
        node(0, sourceType, 0),
        node(1, foreignDefinition.id, 120),
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

  expect(createdNodes.map(({ type }) => type)).toEqual([sourceType, sinkType])

  const [sourceNode, sinkNode] = createdNodes
  expect(graph.links.size).toBe(1)
  const [survivingLink] = graph.links.values()
  expect(survivingLink.origin_id).toBe(sourceNode.id)
  expect(survivingLink.origin_slot).toBe(0)
  expect(survivingLink.target_id).toBe(sinkNode.id)
  expect(survivingLink.target_slot).toBe(0)
})

it('configures actual extension nodes before adding them and preserves relative placement', () => {
  class ExtensionNode extends LGraphNode {
    override onConfigure() {
      this.properties.configuredDetached = this.graph === null
    }

    override onAdded() {
      this.properties.observedConfiguration = this.properties.configuredDetached
    }
  }
  const type = 'test/vintage-configure-before-add'
  LiteGraph.registerNodeType(type, ExtensionNode)
  const graph = new LGraph()
  const createdNodes = deserialiseIntoGraph(
    JSON.stringify({
      nodes: [
        { type, pos: [10, 20] },
        { type, pos: [130, 70] }
      ],
      links: []
    }),
    graph,
    [60, 90]
  )

  expect(createdNodes.map((node) => node instanceof ExtensionNode)).toEqual([
    true,
    true
  ])
  expect(
    createdNodes.map((node) => node.properties.observedConfiguration)
  ).toEqual([true, true])
  expect(createdNodes.map((node) => [...node.pos])).toEqual([
    [60, 90],
    [180, 140]
  ])
})
