import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('Subgraph.reorderInput', () => {
  it('moves an input from one position to another', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'INT' },
        { name: 'c', type: 'FLOAT' }
      ]
    })

    expect(subgraph.inputs.map((i) => i.name)).toEqual(['a', 'b', 'c'])

    subgraph.reorderInput(0, 2)

    expect(subgraph.inputs.map((i) => i.name)).toEqual(['b', 'c', 'a'])
  })

  it('is a no-op when from === to', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'INT' }
      ]
    })

    subgraph.reorderInput(1, 1)

    expect(subgraph.inputs.map((i) => i.name)).toEqual(['a', 'b'])
  })

  it('fixes link origin_slot indices after reorder', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'INT' },
        { name: 'c', type: 'FLOAT' }
      ]
    })

    // Connect interior nodes to subgraph inputs
    const nodeA = new LGraphNode('NodeA')
    nodeA.addInput('value', 'STRING')
    nodeA.inputs[0].widget = { name: 'value' }
    subgraph.add(nodeA)
    subgraph.inputNode.slots[0].connect(nodeA.inputs[0], nodeA)

    const nodeC = new LGraphNode('NodeC')
    nodeC.addInput('value', 'FLOAT')
    nodeC.inputs[0].widget = { name: 'value' }
    subgraph.add(nodeC)
    subgraph.inputNode.slots[2].connect(nodeC.inputs[0], nodeC)

    // Reorder: move 'a' to position 2
    subgraph.reorderInput(0, 2)

    // Verify link origin_slot indices match new positions
    for (const [i, input] of subgraph.inputs.entries()) {
      for (const linkId of input.linkIds) {
        const link = subgraph._links.get(linkId)
        expect(link?.origin_slot).toBe(i)
      }
    }
  })
})

describe('Subgraph.reorderOutput', () => {
  it('moves an output from one position to another', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'x', type: 'STRING' },
        { name: 'y', type: 'INT' },
        { name: 'z', type: 'FLOAT' }
      ]
    })

    expect(subgraph.outputs.map((o) => o.name)).toEqual(['x', 'y', 'z'])

    subgraph.reorderOutput(2, 0)

    expect(subgraph.outputs.map((o) => o.name)).toEqual(['z', 'x', 'y'])
  })
})

describe('SubgraphNode syncs on reorder events', () => {
  it('reorders inputs when subgraph fires input-reordered', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first', type: 'STRING' },
        { name: 'second', type: 'INT' },
        { name: 'third', type: 'FLOAT' }
      ]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.inputs.map((i) => i.name)).toEqual([
      'first',
      'second',
      'third'
    ])

    subgraph.reorderInput(0, 2)

    expect(subgraphNode.inputs.map((i) => i.name)).toEqual([
      'second',
      'third',
      'first'
    ])
  })

  it('reorders outputs when subgraph fires output-reordered', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'out_a', type: 'STRING' },
        { name: 'out_b', type: 'INT' }
      ]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode.outputs.map((o) => o.name)).toEqual(['out_a', 'out_b'])

    subgraph.reorderOutput(1, 0)

    expect(subgraphNode.outputs.map((o) => o.name)).toEqual(['out_b', 'out_a'])
  })

  it('preserves links through reorder', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'STRING' },
        { name: 'b', type: 'INT' }
      ]
    })

    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph ?? subgraph.rootGraph
    parentGraph.add(subgraphNode)

    // Connect an external node to input 0
    const extNode = new LGraphNode('External')
    extNode.addOutput('out', 'STRING')
    parentGraph.add(extNode)
    extNode.connect(0, subgraphNode, 0)

    expect(subgraphNode.inputs[0].link).not.toBeNull()
    const linkId = subgraphNode.inputs[0].link!

    // Reorder: move 'a' from index 0 to index 1
    subgraph.reorderInput(0, 1)

    // 'b' should now be at index 0 (no link), 'a' at index 1 (with link)
    expect(subgraphNode.inputs[0].name).toBe('b')
    expect(subgraphNode.inputs[0].link).toBeNull()
    expect(subgraphNode.inputs[1].name).toBe('a')
    expect(subgraphNode.inputs[1].link).toBe(linkId)
  })
})
