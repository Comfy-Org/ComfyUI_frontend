import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrateLegacyProxyWidgets } from '@/core/graph/subgraph/migrateLegacyProxyWidgets'
import type {
  LGraph,
  Subgraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

interface Setup {
  rootGraph: LGraph
  subgraph: Subgraph
  host: SubgraphNode
  innerNode: LGraphNode
  innerWidgetName: string
}

function setup(widgetName = 'seed', slotType = 'INT'): Setup {
  const rootGraph = createTestRootGraph()
  const subgraph = createTestSubgraph({ rootGraph })

  const innerNode = new LGraphNode('Inner')
  const input = innerNode.addInput(widgetName, slotType)
  innerNode.addWidget('number', widgetName, 0, () => {})
  input.widget = { name: widgetName }
  subgraph.add(innerNode)

  const host = createTestSubgraphNode(subgraph, { parentGraph: rootGraph })

  return { rootGraph, subgraph, host, innerNode, innerWidgetName: widgetName }
}

describe('migrateLegacyProxyWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  it('migrates a two-tuple resolvable entry into a SubgraphInput link', () => {
    const { subgraph, host, innerNode, innerWidgetName } = setup()
    host.properties.proxyWidgets = [[String(innerNode.id), innerWidgetName]]

    const inputsBefore = subgraph.inputs.length

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(inputsBefore + 1)
    const newInput = subgraph.inputs.at(-1)!
    expect(newInput.linkIds.length).toBeGreaterThan(0)
    expect(innerNode.inputs[0].link).not.toBeNull()
    expect(innerNode.inputs[0].link).toBeDefined()
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('ignores the third tuple element (disambiguator) and migrates identically', () => {
    const { subgraph, host, innerNode, innerWidgetName } = setup()
    host.properties.proxyWidgets = [
      [String(innerNode.id), innerWidgetName, 'disambiguator-ignored']
    ]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(1)
    expect(subgraph.inputs[0].linkIds.length).toBeGreaterThan(0)
    expect(innerNode.inputs[0].link).not.toBeNull()
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('drops entries whose source node does not exist', () => {
    const { subgraph, host } = setup()
    host.properties.proxyWidgets = [['99999', 'whatever']]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('drops entries whose source widget name is not found on the node', () => {
    const { subgraph, host, innerNode } = setup()
    host.properties.proxyWidgets = [[String(innerNode.id), 'nonexistent']]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('drops entries for widgets without a backing input slot (preview-style pseudo-widget)', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })

    const innerNode = new LGraphNode('Preview')
    innerNode.addWidget('text', 'preview', '', () => {})
    subgraph.add(innerNode)

    const host = createTestSubgraphNode(subgraph, { parentGraph: rootGraph })
    host.properties.proxyWidgets = [[String(innerNode.id), 'preview']]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('migrates only the resolvable entries when mixed with unresolvable ones', () => {
    const { subgraph, host, innerNode, innerWidgetName } = setup()
    host.properties.proxyWidgets = [
      [String(innerNode.id), innerWidgetName],
      ['99999', 'missing-node'],
      [String(innerNode.id), 'missing-widget']
    ]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(1)
    expect(subgraph.inputs[0].linkIds.length).toBeGreaterThan(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('is idempotent when invoked multiple times', () => {
    const { subgraph, host, innerNode, innerWidgetName } = setup()
    host.properties.proxyWidgets = [[String(innerNode.id), innerWidgetName]]

    migrateLegacyProxyWidgets(host)
    const inputsAfterFirst = subgraph.inputs.length

    expect(() => migrateLegacyProxyWidgets(host)).not.toThrow()

    expect(subgraph.inputs.length).toBe(inputsAfterFirst)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it("drops legacy '-1' source-node-id entries", () => {
    const { subgraph, host } = setup()
    host.properties.proxyWidgets = [['-1', 'someName']]

    migrateLegacyProxyWidgets(host)

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('handles an empty proxyWidgets array as a no-op and deletes the property', () => {
    const { subgraph, host } = setup()
    host.properties.proxyWidgets = []

    expect(() => migrateLegacyProxyWidgets(host)).not.toThrow()

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('handles invalid (non-JSON string) proxyWidgets without throwing', () => {
    const { subgraph, host } = setup()
    host.properties.proxyWidgets = 'not-json'

    expect(() => migrateLegacyProxyWidgets(host)).not.toThrow()

    expect(subgraph.inputs.length).toBe(0)
    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  it('handles undefined proxyWidgets as a no-op', () => {
    const { subgraph, host } = setup()
    host.properties.proxyWidgets = undefined

    expect(() => migrateLegacyProxyWidgets(host)).not.toThrow()

    expect(subgraph.inputs.length).toBe(0)
  })
})
