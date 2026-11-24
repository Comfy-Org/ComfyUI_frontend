import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createTestSubgraph } from './subgraph/__fixtures__/subgraphHelpers'

function nodeWith(
  graph: LGraph,
  slots: { inputs?: string[]; outputs?: string[] }
) {
  const node = new LGraphNode('Node')
  for (const name of slots.inputs ?? []) node.addInput(name, '*')
  for (const name of slots.outputs ?? []) node.addOutput(name, '*')
  graph.add(node)
  return node
}

function linkedInputs(node: LGraphNode) {
  return node.inputs.map(({ name, link }) => [name, link != null])
}

describe('a connection whose callbacks move an end', () => {
  it.for([
    {
      name: 'the input node removes the input it was asked about',
      arrange: (_from: LGraphNode, to: LGraphNode) => {
        to.onConnectInput = () => {
          to.removeInput(0)
          return true
        }
      }
    },
    {
      name: 'the output node removes the input after the input node accepted',
      arrange: (from: LGraphNode, to: LGraphNode) => {
        from.onConnectOutput = () => {
          to.removeInput(0)
          return true
        }
      }
    },
    {
      name: 'the input node removes the output node from the graph',
      arrange: (from: LGraphNode, to: LGraphNode) => {
        to.onConnectInput = () => {
          from.graph?.remove(from)
          return true
        }
      }
    }
  ])('is refused when $name', ({ arrange }) => {
    const graph = new LGraph()
    const from = nodeWith(graph, { outputs: ['out'] })
    const to = nodeWith(graph, { inputs: ['a', 'b'] })
    arrange(from, to)

    expect(from.connect(0, to, 0)).toBeNull()
    expect(graph.links.size).toBe(0)
    expect(to.inputs.every(({ link }) => link == null)).toBe(true)
  })

  it('is made when the callbacks leave both ends where they were', () => {
    const graph = new LGraph()
    const from = nodeWith(graph, { outputs: ['out'] })
    const to = nodeWith(graph, { inputs: ['a', 'b'] })
    to.onConnectInput = () => true
    from.onConnectOutput = () => true

    expect(from.connect(0, to, 0)).not.toBeNull()
    expect(linkedInputs(to)).toEqual([
      ['a', true],
      ['b', false]
    ])
  })

  it('is refused from a subgraph input when the node removes the input it was asked about', () => {
    const subgraph = createTestSubgraph({ inputs: [{ name: 'in', type: '*' }] })
    const to = nodeWith(subgraph, { inputs: ['a', 'b'] })
    to.onConnectInput = () => {
      to.removeInput(0)
      return true
    }

    expect(subgraph.inputs[0].connect(to.inputs[0], to)).toBeUndefined()
    expect(subgraph.links.size).toBe(0)
    expect(linkedInputs(to)).toEqual([['b', false]])
  })

  it('is refused to a subgraph output when the node removes the output it was asked about', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'out', type: '*' }]
    })
    const from = nodeWith(subgraph, { outputs: ['x', 'y'] })
    from.onConnectOutput = () => {
      from.removeOutput(0)
      return true
    }

    expect(subgraph.outputs[0].connect(from.outputs[0], from)).toBeUndefined()
    expect(subgraph.links.size).toBe(0)
  })
})
