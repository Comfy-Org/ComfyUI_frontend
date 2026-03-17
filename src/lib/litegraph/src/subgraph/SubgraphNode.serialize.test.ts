/**
 * Tests for SubgraphNode serialization state isolation.
 *
 * Verifies:
 * 1. serialize() correctly captures instance-scoped promotion metadata
 * 2. Direct serialization (without clone()) preserves correct state — the
 *    _serializeItems path uses item.serialize() for all nodes, avoiding the
 *    clone→serialize gap where transient nodes lose external state
 * 3. Subgraph definition serialization preserves modified widget values
 *
 * @see https://github.com/Comfy-Org/ComfyUI_frontend/issues/9976
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import type { Subgraph, LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { ExportedSubgraphInstance } from '@/lib/litegraph/src/types/serialisation'
import { usePromotionStore } from '@/stores/promotionStore'

import { createTestSubgraph } from './__fixtures__/subgraphHelpers'

/**
 * Creates a subgraph with a single interior node that has a widget,
 * wired through a subgraph input. This creates the promotion binding
 * that serialize() captures in proxyWidgets.
 *
 * Builds on the shared createTestSubgraph helper, adding widget wiring
 * that the base helper doesn't support.
 */
function createSubgraphWithWidgetNode(): {
  rootGraph: LGraph
  subgraph: Subgraph
  interiorNode: LGraphNode
  subgraphNode: SubgraphNode
} {
  const subgraph = createTestSubgraph({ name: 'Test Subgraph' })
  const rootGraph = subgraph.rootGraph

  // Interior node with a widget
  const interiorNode = new LGraphNode('TestInterior')
  interiorNode.serialize_widgets = true
  const nodeInput = interiorNode.addInput('seed', 'INT')
  nodeInput.widget = { name: 'seed' }
  interiorNode.addWidget('number', 'seed', 42, () => {})
  interiorNode.addOutput('out', 'INT')
  subgraph.add(interiorNode)

  // Wire subgraph input → interior node widget input
  const sgInput = subgraph.addInput('seed', 'INT')
  sgInput.connect(nodeInput, interiorNode)

  const instanceData: ExportedSubgraphInstance = {
    id: 1,
    type: subgraph.id,
    pos: [0, 0],
    size: [200, 100],
    inputs: [],
    outputs: [],
    properties: {},
    flags: {},
    mode: 0,
    order: 0
  }
  const subgraphNode = new SubgraphNode(rootGraph, subgraph, instanceData)
  rootGraph.add(subgraphNode)

  return { rootGraph, subgraph, interiorNode, subgraphNode }
}

describe('SubgraphNode.serialize() state isolation (#9976)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('inputs have _widget and _subgraphSlot after construction', () => {
    const { subgraphNode } = createSubgraphWithWidgetNode()

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0]._subgraphSlot).toBeDefined()
    expect(subgraphNode.inputs[0]._widget).toBeDefined()
  })

  it('serialize() captures proxyWidgets from promotionStore for correct instance', () => {
    const { rootGraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    const store = usePromotionStore()

    // The SubgraphNode should have promotions registered (from _setWidget)
    const promotions = store.getPromotions(rootGraph.id, subgraphNode.id)
    expect(promotions).toHaveLength(1)
    expect(promotions[0].interiorNodeId).toBe(String(interiorNode.id))
    expect(promotions[0].widgetName).toBe('seed')

    // Serialize — should write proxyWidgets from promotionStore
    const serialized = subgraphNode.serialize()
    expect(serialized.properties?.proxyWidgets).toEqual([
      [String(interiorNode.id), 'seed']
    ])
  })

  it('clone with different id still gets proxyWidgets from construction, not original', () => {
    const { rootGraph, subgraph, subgraphNode } = createSubgraphWithWidgetNode()

    const store = usePromotionStore()

    // Original has promotions
    const promotions = store.getPromotions(rootGraph.id, subgraphNode.id)
    expect(promotions).toHaveLength(1)

    // Create a second SubgraphNode with a DIFFERENT id (simulating clone)
    const cloneInstanceData: ExportedSubgraphInstance = {
      id: 999,
      type: subgraph.id,
      pos: [0, 0],
      size: [200, 100],
      inputs: [],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    }
    const cloneNode = new SubgraphNode(rootGraph, subgraph, cloneInstanceData)
    rootGraph.add(cloneNode)

    // The clone's serialize() queries promotionStore with id=999
    const cloneSerialized = cloneNode.serialize()

    // The clone DOES get proxyWidgets because _resolveInputWidget ran during
    // construction. But the critical issue is:
    // In _serializeItems, the clone is created, serialize() runs, then
    // the serialized data has cloneNode.id, NOT the original node's id.
    // Then _serializeItems sets `cloned.id = item.id` (L3908),
    // but the proxyWidgets were already captured with the wrong id context.
    expect(cloneSerialized.properties?.proxyWidgets).toBeDefined()
  })

  it('serialize() preserves modified interior widget values', () => {
    const { interiorNode, subgraphNode } = createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 999
    subgraphNode.serialize()

    expect(interiorNode.widgets![0].value).toBe(999)
  })

  it('asSerialisable() captures current widget values', () => {
    const { subgraph, interiorNode } = createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 777

    const exported = subgraph.asSerialisable()
    const serializedNode = exported.nodes?.find((n) => n.id === interiorNode.id)
    expect(serializedNode?.widgets_values?.[0]).toBe(777)
  })

  it('direct serialize() preserves proxyWidgets and widget values', () => {
    const { subgraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    // Direct serialization captures correct proxyWidgets
    const originalSerialized = subgraphNode.serialize()
    expect(originalSerialized.properties?.proxyWidgets).toEqual([
      [String(interiorNode.id), 'seed']
    ])

    // Modify widget value
    interiorNode.widgets![0].value = 555

    // Subgraph definition serialization should capture modified value
    const exported = subgraph.clone(true).asSerialisable()
    const serializedNode = exported.nodes?.find((n) => n.id === interiorNode.id)
    expect(serializedNode?.widgets_values?.[0]).toBe(555)
  })
})

describe('Subgraph copy roundtrip preserves state (#9976)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('serialized subgraph definition preserves modified widget values', () => {
    const { subgraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 123

    // Full _serializeItems-style flow
    subgraphNode.serialize()
    const exported = subgraph.clone(true).asSerialisable()

    const serializedNode = exported.nodes?.find((n) => n.id === interiorNode.id)
    expect(serializedNode?.widgets_values?.[0]).toBe(123)
  })

  it('multiple instances: serialization order does not affect definition values', () => {
    const { rootGraph, subgraph, interiorNode } = createSubgraphWithWidgetNode()

    const subgraphNode2 = new SubgraphNode(rootGraph, subgraph, {
      id: 2,
      type: subgraph.id,
      pos: [300, 0],
      size: [200, 100],
      inputs: [],
      outputs: [],
      properties: {},
      flags: {},
      mode: 0,
      order: 0
    })
    rootGraph.add(subgraphNode2)

    interiorNode.widgets![0].value = 888

    // Serialize both instances
    const firstNode = rootGraph.nodes.find(
      (n): n is SubgraphNode => n instanceof SubgraphNode && n.id === 1
    )!
    firstNode.serialize()
    subgraphNode2.serialize()

    const exported = subgraph.clone(true).asSerialisable()
    const serializedNode = exported.nodes?.find((n) => n.id === interiorNode.id)
    expect(serializedNode?.widgets_values?.[0]).toBe(888)
  })
})
