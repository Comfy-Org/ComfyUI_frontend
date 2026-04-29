import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { normalizeLegacyProxyWidgetEntry } from '@/core/graph/subgraph/legacyProxyWidgetNormalization'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

function createHostWithInnerWidget(widgetName: string) {
  const rootGraph = createTestRootGraph()
  const innerSubgraph = createTestSubgraph({
    rootGraph,
    inputs: [{ name: 'value', type: 'number' }]
  })

  const innerNode = new LGraphNode('InnerNode')
  const input = innerNode.addInput('value', 'number')
  innerNode.addWidget('number', widgetName, 0, () => {})
  input.widget = { name: widgetName }
  innerSubgraph.add(innerNode)
  innerSubgraph.inputNode.slots[0].connect(innerNode.inputs[0], innerNode)

  const hostNode = createTestSubgraphNode(innerSubgraph, {
    parentGraph: rootGraph
  })

  return { rootGraph, innerSubgraph, innerNode, hostNode }
}

describe('normalizeLegacyProxyWidgetEntry', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  it('returns entry unchanged when it already resolves', () => {
    const { hostNode, innerNode } = createHostWithInnerWidget('seed')

    const result = normalizeLegacyProxyWidgetEntry(
      hostNode,
      String(innerNode.id),
      'seed'
    )

    expect(result).toEqual({
      sourceNodeId: String(innerNode.id),
      sourceWidgetName: 'seed'
    })
  })

  it('returns entry unchanged with disambiguator when it already resolves', () => {
    const { hostNode, innerNode } = createHostWithInnerWidget('seed')

    const result = normalizeLegacyProxyWidgetEntry(
      hostNode,
      String(innerNode.id),
      'seed',
      String(innerNode.id)
    )

    expect(result).toEqual({
      sourceNodeId: String(innerNode.id),
      sourceWidgetName: 'seed',
      disambiguatingSourceNodeId: String(innerNode.id)
    })
  })

  it('infers the leaf-node disambiguator for nested subgraph entries', () => {
    const rootGraph = createTestRootGraph()
    const innerSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: 'number' }]
    })

    const samplerNode = new LGraphNode('Sampler')
    const samplerInput = samplerNode.addInput('seed', 'number')
    samplerNode.addWidget('number', 'noise_seed', 42, () => {})
    samplerInput.widget = { name: 'noise_seed' }
    innerSubgraph.add(samplerNode)
    innerSubgraph.inputNode.slots[0].connect(samplerNode.inputs[0], samplerNode)

    const outerSubgraph = createTestSubgraph({ rootGraph })
    const nestedNode = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(nestedNode)

    const hostNode = createTestSubgraphNode(outerSubgraph, {
      parentGraph: rootGraph
    })

    const result = normalizeLegacyProxyWidgetEntry(
      hostNode,
      String(nestedNode.id),
      'seed'
    )

    expect(result).toEqual({
      sourceNodeId: String(nestedNode.id),
      sourceWidgetName: 'seed',
      disambiguatingSourceNodeId: String(samplerNode.id)
    })
  })

  it('strips a single legacy prefix from widget name', () => {
    const rootGraph = createTestRootGraph()
    const innerSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: 'number' }]
    })

    const samplerNode = new LGraphNode('Sampler')
    const samplerInput = samplerNode.addInput('seed', 'number')
    samplerNode.addWidget('number', 'noise_seed', 42, () => {})
    samplerInput.widget = { name: 'noise_seed' }
    innerSubgraph.add(samplerNode)
    innerSubgraph.inputNode.slots[0].connect(samplerNode.inputs[0], samplerNode)

    const outerSubgraph = createTestSubgraph({ rootGraph })
    const nestedNode = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(nestedNode)

    const hostNode = createTestSubgraphNode(outerSubgraph, {
      parentGraph: rootGraph
    })

    const prefixedName = `${nestedNode.id}: ${samplerNode.id}: noise_seed`
    const result = normalizeLegacyProxyWidgetEntry(
      hostNode,
      String(nestedNode.id),
      prefixedName
    )

    expect(result.sourceWidgetName).toBe('noise_seed')
    expect(result.disambiguatingSourceNodeId).toBe(String(samplerNode.id))
  })

  it('returns original entry when prefix cannot be resolved', () => {
    const { hostNode, innerNode } = createHostWithInnerWidget('seed')

    const result = normalizeLegacyProxyWidgetEntry(
      hostNode,
      String(innerNode.id),
      '999: nonexistent_widget'
    )

    expect(result).toEqual({
      sourceNodeId: String(innerNode.id),
      sourceWidgetName: '999: nonexistent_widget'
    })
  })
})
