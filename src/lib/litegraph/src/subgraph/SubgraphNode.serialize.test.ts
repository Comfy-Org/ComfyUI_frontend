import { describe, expect } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'

import { subgraphTest as test } from './__fixtures__/subgraphFixtures'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from './__fixtures__/subgraphHelpers'

function createSubgraphWithWidgetNode(): {
  subgraphNode: SubgraphNode
} {
  const subgraph = createTestSubgraph({ name: 'Test Subgraph' })
  const rootGraph = subgraph.rootGraph
  const interiorNode = new LGraphNode('TestInterior')
  const nodeInput = interiorNode.addInput('seed', 'INT')
  nodeInput.widget = { name: 'seed' }
  interiorNode.addWidget('number', 'seed', 42, () => {})
  subgraph.add(interiorNode)

  subgraph.addInput('seed', 'INT').connect(nodeInput, interiorNode)

  const subgraphNode = createTestSubgraphNode(subgraph, { id: 1 })
  rootGraph.add(subgraphNode)
  return { subgraphNode }
}

describe('SubgraphNode serialization state isolation (#9976)', () => {
  test('serializes the current promoted widget value', () => {
    const { subgraphNode } = createSubgraphWithWidgetNode()

    subgraphNode.inputs[0]._widget!.value = 123

    expect(subgraphNode.serialize().widgets_values).toEqual([123])
  })

  test('direct serialization creates a stable snapshot', () => {
    const { subgraphNode } = createSubgraphWithWidgetNode()
    subgraphNode.inputs[0]._widget!.value = 123

    const snapshot = LiteGraph.cloneObject(subgraphNode.serialize())!
    subgraphNode.inputs[0]._widget!.value = 456

    expect(snapshot.widgets_values).toEqual([123])
    expect(subgraphNode.serialize().widgets_values).toEqual([456])
  })
})
