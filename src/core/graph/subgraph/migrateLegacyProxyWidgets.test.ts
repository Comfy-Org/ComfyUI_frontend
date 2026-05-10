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

  describe('nested promotions', () => {
    interface NestedSetup {
      rootGraph: LGraph
      hostSubgraph: Subgraph
      innerSubgraph: Subgraph
      innerLeaf: LGraphNode
      nestedNode: SubgraphNode
      host: SubgraphNode
      promotedWidgetName: string
    }

    /**
     * Builds: rootGraph -> host(SubgraphNode for hostSubgraph)
     *                    └── hostSubgraph contains nestedNode(SubgraphNode for innerSubgraph)
     *                          └── innerSubgraph contains innerLeaf with `seed` widget
     *                                connected through innerSubgraph's input.
     * The nestedNode surfaces a promoted widget named after the inner subgraph
     * input (`seed` here).
     */
    function nestedSetup(promotedName = 'seed'): NestedSetup {
      const rootGraph = createTestRootGraph()

      const innerSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: promotedName, type: 'INT' }]
      })

      const innerLeaf = new LGraphNode('Leaf')
      const leafInput = innerLeaf.addInput(promotedName, 'INT')
      innerLeaf.addWidget('number', promotedName, 0, () => {})
      leafInput.widget = { name: promotedName }
      innerSubgraph.add(innerLeaf)
      innerSubgraph.inputNode.slots[0].connect(innerLeaf.inputs[0], innerLeaf)

      const hostSubgraph = createTestSubgraph({ rootGraph })

      const nestedNode = createTestSubgraphNode(innerSubgraph, {
        parentGraph: hostSubgraph
      })
      hostSubgraph.add(nestedNode)

      const host = createTestSubgraphNode(hostSubgraph, {
        parentGraph: rootGraph
      })

      return {
        rootGraph,
        hostSubgraph,
        innerSubgraph,
        innerLeaf,
        nestedNode,
        host,
        promotedWidgetName: promotedName
      }
    }

    it('migrates an entry whose source widget is on a nested SubgraphNode', () => {
      const {
        host,
        hostSubgraph,
        innerSubgraph,
        nestedNode,
        promotedWidgetName
      } = nestedSetup()

      const innerInputsBefore = innerSubgraph.inputs.length
      host.properties.proxyWidgets = [
        [String(nestedNode.id), promotedWidgetName]
      ]

      migrateLegacyProxyWidgets(host)

      expect(hostSubgraph.inputs.length).toBe(1)
      const newInput = hostSubgraph.inputs[0]
      expect(newInput.name).toBe(promotedWidgetName)
      expect(newInput.linkIds.length).toBeGreaterThan(0)

      const nestedSlot = nestedNode.inputs.find(
        (slot) => slot._subgraphSlot?.name === promotedWidgetName
      )
      expect(nestedSlot).toBeDefined()
      expect(nestedSlot?.link).not.toBeNull()
      expect(nestedSlot?.link).toBeDefined()

      // The nested subgraph's own promotion structure is unaffected.
      expect(innerSubgraph.inputs.length).toBe(innerInputsBefore)

      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('skips entries whose source slot already has a non-null link', () => {
      const { subgraph, host, innerNode, innerWidgetName } = setup()

      // Pre-wire the inner node's slot through a SubgraphInput so its
      // `link` is non-null before migration runs.
      const preExistingInput = subgraph.addInput(innerWidgetName, 'INT')
      const preLink = preExistingInput.connect(innerNode.inputs[0], innerNode)
      expect(preLink).not.toBeNull()
      const inputsBefore = subgraph.inputs.length
      const preExistingLinkId = innerNode.inputs[0].link
      expect(preExistingLinkId).not.toBeNull()

      host.properties.proxyWidgets = [[String(innerNode.id), innerWidgetName]]

      migrateLegacyProxyWidgets(host)

      // No new SubgraphInput; pre-existing link untouched.
      expect(subgraph.inputs.length).toBe(inputsBefore)
      expect(innerNode.inputs[0].link).toBe(preExistingLinkId)
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('migrates multiple entries pointing at widgets on the same nested SubgraphNode', () => {
      const rootGraph = createTestRootGraph()

      const innerSubgraph = createTestSubgraph({
        rootGraph,
        inputs: [
          { name: 'seed', type: 'INT' },
          { name: 'steps', type: 'INT' }
        ]
      })

      const innerLeaf = new LGraphNode('Leaf')
      const seedInput = innerLeaf.addInput('seed', 'INT')
      const stepsInput = innerLeaf.addInput('steps', 'INT')
      innerLeaf.addWidget('number', 'seed', 0, () => {})
      innerLeaf.addWidget('number', 'steps', 20, () => {})
      seedInput.widget = { name: 'seed' }
      stepsInput.widget = { name: 'steps' }
      innerSubgraph.add(innerLeaf)
      innerSubgraph.inputNode.slots[0].connect(innerLeaf.inputs[0], innerLeaf)
      innerSubgraph.inputNode.slots[1].connect(innerLeaf.inputs[1], innerLeaf)

      const hostSubgraph = createTestSubgraph({ rootGraph })
      const nestedNode = createTestSubgraphNode(innerSubgraph, {
        parentGraph: hostSubgraph
      })
      hostSubgraph.add(nestedNode)

      const host = createTestSubgraphNode(hostSubgraph, {
        parentGraph: rootGraph
      })
      host.properties.proxyWidgets = [
        [String(nestedNode.id), 'seed'],
        [String(nestedNode.id), 'steps']
      ]

      migrateLegacyProxyWidgets(host)

      expect(hostSubgraph.inputs.length).toBe(2)
      const names = hostSubgraph.inputs.map((i) => i.name)
      expect(new Set(names).size).toBe(names.length)
      expect(names).toEqual(expect.arrayContaining(['seed', 'steps']))
      for (const input of hostSubgraph.inputs) {
        expect(input.linkIds.length).toBeGreaterThan(0)
      }

      const seedSlot = nestedNode.inputs.find(
        (slot) => slot._subgraphSlot?.name === 'seed'
      )
      const stepsSlot = nestedNode.inputs.find(
        (slot) => slot._subgraphSlot?.name === 'steps'
      )
      expect(seedSlot?.link).not.toBeNull()
      expect(stepsSlot?.link).not.toBeNull()
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it("does not touch the inner SubgraphNode's own legacy proxyWidgets", () => {
      const { host, hostSubgraph, nestedNode, promotedWidgetName } =
        nestedSetup()

      const innerLegacy: [string, string][] = [['12345', 'untouched']]
      nestedNode.properties.proxyWidgets = innerLegacy.map(
        (entry) => [...entry] as [string, string]
      )

      host.properties.proxyWidgets = [
        [String(nestedNode.id), promotedWidgetName]
      ]

      migrateLegacyProxyWidgets(host)

      expect(host.properties.proxyWidgets).toBeUndefined()
      expect(hostSubgraph.inputs.length).toBe(1)
      expect(nestedNode.properties.proxyWidgets).toStrictEqual(innerLegacy)
    })

    it('drops two-level nested entries whose source widget is itself a chained PromotedWidgetView', () => {
      // Pins the current contract: when the source widget on the immediate
      // child SubgraphNode is itself a chained promotion (PromotedWidgetView),
      // SubgraphNode.getSlotFromWidget returns undefined due to a view-cache
      // identity mismatch and the migration drops the entry silently. This is
      // consistent with case 5 (no backing input slot → drop) and with the
      // plan's "unresolvable entries are dropped silently" contract. Lifting
      // this restriction requires fixing the disambiguator-aware viewKey
      // identity in SubgraphNode and is tracked as a follow-up.
      const rootGraph = createTestRootGraph()

      // Innermost (B): contains the leaf widget.
      const subgraphB = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'seed', type: 'INT' }]
      })
      const leafB = new LGraphNode('LeafB')
      const leafInputB = leafB.addInput('seed', 'INT')
      leafB.addWidget('number', 'seed', 7, () => {})
      leafInputB.widget = { name: 'seed' }
      subgraphB.add(leafB)
      subgraphB.inputNode.slots[0].connect(leafB.inputs[0], leafB)

      // Middle (A): contains a SubgraphNode for B; surfaces seed via its own input.
      const subgraphA = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'seed', type: 'INT' }]
      })
      const nodeForB = createTestSubgraphNode(subgraphB, {
        parentGraph: subgraphA
      })
      subgraphA.add(nodeForB)
      const nodeForBSeedSlot = nodeForB.inputs.find(
        (slot) => slot._subgraphSlot?.name === 'seed'
      )
      expect(nodeForBSeedSlot).toBeDefined()
      subgraphA.inputNode.slots[0].connect(nodeForBSeedSlot!, nodeForB)

      // Host: contains a SubgraphNode for A.
      const hostSubgraph = createTestSubgraph({ rootGraph })
      const nodeForA = createTestSubgraphNode(subgraphA, {
        parentGraph: hostSubgraph
      })
      hostSubgraph.add(nodeForA)

      const host = createTestSubgraphNode(hostSubgraph, {
        parentGraph: rootGraph
      })
      host.properties.proxyWidgets = [[String(nodeForA.id), 'seed']]

      migrateLegacyProxyWidgets(host)

      expect(hostSubgraph.inputs.length).toBe(0)
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it.todo(
      'should resolve two-level nested chained promotions once the disambiguator-aware viewKey identity in SubgraphNode is fixed'
    )

    it('uses nextUniqueName when the desired name collides with an existing input', () => {
      const { subgraph, host, innerNode } = setup('width', 'INT')
      // Pre-existing input with the same name (and type irrelevant for the test).
      const existingInput = subgraph.addInput('width', 'INT')
      const otherNode = new LGraphNode('Other')
      otherNode.addOutput('width', 'INT')
      subgraph.add(otherNode)
      const preExistingLink = existingInput.connect(
        otherNode.inputs[0] ?? otherNode.outputs[0],
        otherNode
      )
      // The pre-existing input may or may not connect depending on slot
      // direction; we only care that it remains in the inputs list with its
      // identity preserved.
      void preExistingLink

      const inputsBefore = subgraph.inputs.length
      host.properties.proxyWidgets = [[String(innerNode.id), 'width']]

      migrateLegacyProxyWidgets(host)

      expect(subgraph.inputs.length).toBe(inputsBefore + 1)
      expect(subgraph.inputs[0]).toBe(existingInput)
      expect(subgraph.inputs[0].name).toBe('width')

      const newInput = subgraph.inputs.at(-1)!
      expect(newInput).not.toBe(existingInput)
      expect(newInput.name).not.toBe('width')
      expect(newInput.name.startsWith('width')).toBe(true)
      expect(newInput.linkIds.length).toBeGreaterThan(0)
      expect(host.properties.proxyWidgets).toBeUndefined()
    })

    it('drops entries when the nested SubgraphNode has not materialized the widget', () => {
      const rootGraph = createTestRootGraph()

      // Inner subgraph with no inputs and no leaf widgets — a SubgraphNode
      // built from this surfaces zero promoted widgets.
      const innerSubgraph = createTestSubgraph({ rootGraph })

      const hostSubgraph = createTestSubgraph({ rootGraph })
      const nestedNode = createTestSubgraphNode(innerSubgraph, {
        parentGraph: hostSubgraph
      })
      hostSubgraph.add(nestedNode)

      // Sanity: the nested SubgraphNode has no synthetic widgets to promote.
      expect(nestedNode.widgets.length).toBe(0)

      const host = createTestSubgraphNode(hostSubgraph, {
        parentGraph: rootGraph
      })
      host.properties.proxyWidgets = [[String(nestedNode.id), 'never_promoted']]

      expect(() => migrateLegacyProxyWidgets(host)).not.toThrow()

      expect(hostSubgraph.inputs.length).toBe(0)
      expect(host.properties.proxyWidgets).toBeUndefined()
    })
  })
})
