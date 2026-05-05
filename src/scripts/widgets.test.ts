import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { isControlExternallyDriven } from './widgets'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('isControlExternallyDriven', () => {
  it('returns false when the widget input has no link', () => {
    const node = new LGraphNode('TestNode')
    const widget = node.addWidget('number', 'value', 0, () => {})
    node.addInput('value', 'INT')
    node.inputs[0].widget = { name: 'value' }

    expect(isControlExternallyDriven(node, widget)).toBe(false)
  })

  it('returns true when a regular node widget input has a direct link', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    graph.add(source)

    const target = new LGraphNode('Target')
    const widget = target.addWidget('number', 'value', 0, () => {})
    target.addInput('value', 'INT')
    target.inputs[0].widget = { name: 'value' }
    graph.add(target)

    source.connect(0, target, 0)

    expect(isControlExternallyDriven(target, widget)).toBe(true)
  })

  it('returns true for subgraph interior node when SubgraphNode input has external link', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'INT' }]
    })

    // Interior node with widget linked to SubgraphInput
    const interiorNode = new LGraphNode('Interior')
    const widget = interiorNode.addWidget('number', 'value', 0, () => {})
    interiorNode.addInput('value', 'INT')
    interiorNode.inputs[0].widget = { name: 'value' }
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = subgraphNode.graph ?? subgraph.rootGraph
    parentGraph.add(subgraphNode)

    // External source node connected to SubgraphNode
    const extSource = new LGraphNode('ExtSource')
    extSource.addOutput('out', 'INT')
    parentGraph.add(extSource)

    extSource.connect(0, subgraphNode, 0)

    expect(isControlExternallyDriven(interiorNode, widget)).toBe(true)
  })

  it('returns false for subgraph interior node when SubgraphNode input has no external link', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'INT' }]
    })

    const interiorNode = new LGraphNode('Interior')
    const widget = interiorNode.addWidget('number', 'value', 0, () => {})
    interiorNode.addInput('value', 'INT')
    interiorNode.inputs[0].widget = { name: 'value' }
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorNode.inputs[0], interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraph.rootGraph.add(subgraphNode)

    // No external link on SubgraphNode — control should work
    expect(isControlExternallyDriven(interiorNode, widget)).toBe(false)
  })
})
