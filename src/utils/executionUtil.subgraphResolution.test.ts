/**
 * Frontend-node resolution has to reach every graph the prompt draws from.
 *
 * Both passes work on whichever graph they are handed — `resolution.test.ts`
 * calls the supplier one with a subgraph directly and it behaves. The prompt
 * builder, though, calls each once with the root graph and then walks a node
 * set that includes subgraph interiors, so a supplier or resolver living
 * inside a subgraph is never asked. The keys do not even line up: resolution
 * writes `3:0` while an inner node looks itself up as `5:3:0`.
 *
 * That is invisible in the result. The input is simply absent from the prompt,
 * which reads as "the user left it unconnected" rather than as a broadcast
 * that stopped at an encapsulation boundary.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createComfyApi } from '@/platform/nodeApi/comfyApi'
import { createDefRegistry } from '@/platform/nodeApi/defsRegistry'

import { graphToPrompt } from './executionUtil'

const BROADCASTER_DEF = {
  name: 'Broadcaster',
  display_name: 'Broadcaster',
  category: 'testing',
  python_module: 'custom_nodes.demo',
  output: ['MODEL'],
  output_name: ['out'],
  input: { required: {} }
}

const cleanups: (() => void)[] = []

function registerType(type: string, build: (node: LGraphNode) => void) {
  class Generated extends LGraphNode {
    constructor() {
      super(type, type)
      build(this)
    }
  }
  LiteGraph.registerNodeType(type, Generated)
  cleanups.push(() => LiteGraph.unregisterNodeType(type))
  return Generated
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

describe('frontend resolution inside a subgraph', () => {
  it('asks a supplier that lives inside a subgraph', async () => {
    const root = new LGraph()
    const comfy = createComfyApi(() => root)

    const Broadcaster = registerType('Broadcaster', (node) => {
      node.addOutput('out', 'MODEL')
    })
    registerType('Consumer', (node) => {
      node.addInput('model', 'MODEL')
    })

    const registry = createDefRegistry()
    registry
      .forMajor((id) => comfy.graph.node(id)!)
      .extend('Broadcaster', (b) =>
        b.setSupply((view) =>
          view
            .unconnectedInputs()
            .filter((input) => input.nodeType === 'Consumer')
            .map((input) => ({
              from: { output: 0 },
              to: { nodeId: input.nodeId, input: input.input }
            }))
        )
      )
    registry.applyTo(Broadcaster, BROADCASTER_DEF)

    // Broadcaster and target both sit inside the subgraph, so this is
    // resolution within one scope — nothing crosses the boundary.
    const subgraph = createTestSubgraph({ rootGraph: root })
    subgraph.add(LiteGraph.createNode('Broadcaster')!)
    subgraph.add(LiteGraph.createNode('Consumer')!)
    root.add(createTestSubgraphNode(subgraph))

    const { output } = await graphToPrompt(root)

    // Both land in the prompt under the subgraph's execution prefix, which is
    // the half that already works — `3:1` and `3:2` rather than `1` and `2`.
    const consumer = Object.values(output).find(
      (entry) => entry._meta?.title === 'Consumer'
    )
    expect(consumer).toBeDefined()
    expect(consumer!.inputs.model).toBeDefined()
  })
})
