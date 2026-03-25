import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  ExportedSubgraphInstance,
  Positionable,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { usePromotionStore } from '@/stores/promotionStore'

/**
 * Registers a minimal SubgraphNode class for a subgraph definition
 * so that `LiteGraph.createNode(subgraphId)` works in tests.
 */
function registerSubgraphNodeType(subgraph: Subgraph): void {
  const instanceData: ExportedSubgraphInstance = {
    id: -1,
    type: subgraph.id,
    pos: [0, 0],
    size: [100, 100],
    inputs: [],
    outputs: [],
    flags: {},
    order: 0,
    mode: 0
  }

  const node = class extends SubgraphNode {
    constructor() {
      super(subgraph.rootGraph, subgraph, instanceData)
    }
  }
  Object.defineProperty(node, 'title', { value: subgraph.name })
  LiteGraph.registerNodeType(subgraph.id, node)
}

const registeredTypes: string[] = []

afterEach(() => {
  for (const type of registeredTypes) {
    LiteGraph.unregisterNodeType(type)
  }
  registeredTypes.length = 0
})

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('_repointAncestorPromotions', () => {
  function setupParentSubgraphWithWidgets() {
    const parentSubgraph = createTestSubgraph({
      name: 'Parent Subgraph',
      inputs: [{ name: 'input', type: '*' }],
      outputs: [{ name: 'output', type: '*' }]
    })
    const rootGraph = parentSubgraph.rootGraph

    // We need to listen for new subgraph registrations so
    // LiteGraph.createNode works during convertToSubgraph
    rootGraph.events.addEventListener('subgraph-created', (e) => {
      const { subgraph } = e.detail
      registerSubgraphNodeType(subgraph)
      registeredTypes.push(subgraph.id)
    })

    const interiorNode = new LGraphNode('Interior Node')
    interiorNode.addInput('in', '*')
    interiorNode.addOutput('out', '*')
    interiorNode.addWidget('text', 'prompt', 'hello world', () => {})
    parentSubgraph.add(interiorNode)

    // Create host SubgraphNode in root graph
    registerSubgraphNodeType(parentSubgraph)
    registeredTypes.push(parentSubgraph.id)
    const hostNode = createTestSubgraphNode(parentSubgraph)
    rootGraph.add(hostNode)

    return { rootGraph, parentSubgraph, interiorNode, hostNode }
  }

  it('repoints parent promotions when interior nodes are packed into a nested subgraph', () => {
    const { rootGraph, parentSubgraph, interiorNode, hostNode } =
      setupParentSubgraphWithWidgets()

    // Promote the interior node's widget on the host
    const store = usePromotionStore()
    store.promote(rootGraph.id, hostNode.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'prompt'
    })

    const beforeEntries = store.getPromotions(rootGraph.id, hostNode.id)
    expect(beforeEntries).toHaveLength(1)
    expect(beforeEntries[0].sourceNodeId).toBe(String(interiorNode.id))

    // Pack the interior node into a nested subgraph
    const { node: nestedSubgraphNode } = parentSubgraph.convertToSubgraph(
      new Set<Positionable>([interiorNode])
    )

    // After conversion, the host's promotion should be repointed
    const afterEntries = store.getPromotions(rootGraph.id, hostNode.id)
    expect(afterEntries).toHaveLength(1)
    expect(afterEntries[0].sourceNodeId).toBe(String(nestedSubgraphNode.id))
    expect(afterEntries[0].sourceWidgetName).toBe('prompt')
    expect(afterEntries[0].disambiguatingSourceNodeId).toBe(
      String(interiorNode.id)
    )

    // The nested subgraph node should also have the promotion
    const nestedEntries = store.getPromotions(
      rootGraph.id,
      nestedSubgraphNode.id
    )
    expect(nestedEntries).toHaveLength(1)
    expect(nestedEntries[0].sourceNodeId).toBe(String(interiorNode.id))
    expect(nestedEntries[0].sourceWidgetName).toBe('prompt')
  })

  it('preserves promotions that reference non-moved nodes', () => {
    const { rootGraph, parentSubgraph, interiorNode, hostNode } =
      setupParentSubgraphWithWidgets()

    const remainingNode = new LGraphNode('Remaining Node')
    remainingNode.addWidget('text', 'widget_b', 'b', () => {})
    parentSubgraph.add(remainingNode)

    const store = usePromotionStore()
    store.promote(rootGraph.id, hostNode.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'prompt'
    })
    store.promote(rootGraph.id, hostNode.id, {
      sourceNodeId: String(remainingNode.id),
      sourceWidgetName: 'widget_b'
    })

    // Pack only the interiorNode
    parentSubgraph.convertToSubgraph(new Set<Positionable>([interiorNode]))

    const afterEntries = store.getPromotions(rootGraph.id, hostNode.id)
    expect(afterEntries).toHaveLength(2)

    // The remaining node's promotion should be unchanged
    const remainingEntry = afterEntries.find(
      (e) => e.sourceWidgetName === 'widget_b'
    )
    expect(remainingEntry?.sourceNodeId).toBe(String(remainingNode.id))
    expect(remainingEntry?.disambiguatingSourceNodeId).toBeUndefined()

    // The moved node's promotion should be repointed
    const movedEntry = afterEntries.find((e) => e.sourceWidgetName === 'prompt')
    expect(movedEntry?.sourceNodeId).not.toBe(String(interiorNode.id))
    expect(movedEntry?.disambiguatingSourceNodeId).toBe(String(interiorNode.id))
  })

  it('does not modify promotions when converting in root graph', () => {
    const parentSubgraph = createTestSubgraph({ name: 'Dummy' })
    const rootGraph = parentSubgraph.rootGraph

    rootGraph.events.addEventListener('subgraph-created', (e) => {
      const { subgraph } = e.detail
      registerSubgraphNodeType(subgraph)
      registeredTypes.push(subgraph.id)
    })

    const node = new LGraphNode('Root Node')
    node.addInput('in', '*')
    node.addOutput('out', '*')
    node.addWidget('text', 'value', 'test', () => {})
    rootGraph.add(node)

    // Converting in root graph should not throw
    rootGraph.convertToSubgraph(new Set<Positionable>([node]))
  })
})
