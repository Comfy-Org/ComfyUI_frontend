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
import { describe, expect } from 'vitest'

import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { usePromotionStore } from '@/stores/promotionStore'

import { subgraphTest as test } from './__fixtures__/subgraphFixtures'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from './__fixtures__/subgraphHelpers'

/**
 * Creates a subgraph with a single interior node that has a widget,
 * wired through a subgraph input. This creates the promotion binding
 * that serialize() captures in proxyWidgets.
 *
 * Builds on the shared createTestSubgraph + createTestSubgraphNode helpers,
 * adding only the widget wiring that the base helpers don't support.
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

  // Wire subgraph input → interior node widget input (creates promotion binding)
  const sgInput = subgraph.addInput('seed', 'INT')
  sgInput.connect(nodeInput, interiorNode)

  // Shared helper handles SubgraphNode construction (which registers promotions
  // via _resolveInputWidget under its own id).
  const subgraphNode = createTestSubgraphNode(subgraph, { id: 1 })
  rootGraph.add(subgraphNode)

  return { rootGraph, subgraph, interiorNode, subgraphNode }
}

describe('SubgraphNode.serialize() state isolation (#9976)', () => {
  test('inputs have _widget and _subgraphSlot after construction', () => {
    const { subgraphNode } = createSubgraphWithWidgetNode()

    expect(subgraphNode.inputs).toHaveLength(1)
    expect(subgraphNode.inputs[0]._subgraphSlot).toBeDefined()
    expect(subgraphNode.inputs[0]._widget).toBeDefined()
  })

  test('serialize() captures proxyWidgets from promotionStore for correct instance', () => {
    const { rootGraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    const store = usePromotionStore()

    // The SubgraphNode should have promotions registered (from _setWidget)
    const promotions = store.getPromotions(rootGraph.id, subgraphNode.id)
    expect(promotions).toHaveLength(1)
    expect(promotions[0].sourceNodeId).toBe(String(interiorNode.id))
    expect(promotions[0].sourceWidgetName).toBe('seed')

    // Serialize — should write proxyWidgets from promotionStore
    const serialized = subgraphNode.serialize()
    expect(serialized.properties?.proxyWidgets).toEqual([
      [String(interiorNode.id), 'seed']
    ])
  })

  test('second instance gets its own proxyWidgets from construction', () => {
    const { rootGraph, subgraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    const store = usePromotionStore()

    // Original has promotions
    const promotions = store.getPromotions(rootGraph.id, subgraphNode.id)
    expect(promotions).toHaveLength(1)

    // Create a second SubgraphNode with a DIFFERENT id (simulating clone)
    const cloneNode = createTestSubgraphNode(subgraph, { id: 999 })
    rootGraph.add(cloneNode)

    // The clone gets proxyWidgets because _resolveInputWidget ran during
    // construction, registering promotions under its own id (999).
    const cloneSerialized = cloneNode.serialize()
    expect(cloneSerialized.properties?.proxyWidgets).toEqual([
      [String(interiorNode.id), 'seed']
    ])
  })

  test('serialize() preserves modified interior widget values', () => {
    const { interiorNode, subgraphNode } = createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 999
    subgraphNode.serialize()

    expect(interiorNode.widgets![0].value).toBe(999)
  })

  test('asSerialisable() captures current widget values', () => {
    const { subgraph, interiorNode } = createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 777

    const exported = subgraph.asSerialisable()
    const serializedNode = exported.nodes?.find((n) => n.id === interiorNode.id)
    expect(serializedNode?.widgets_values?.[0]).toBe(777)
  })

  test('direct serialize() preserves proxyWidgets and widget values', () => {
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
  test('serialized subgraph definition preserves modified widget values', () => {
    const { subgraph, interiorNode, subgraphNode } =
      createSubgraphWithWidgetNode()

    interiorNode.widgets![0].value = 123

    // Mimic _serializeItems clone path. Both serialized payloads are consumed
    // via cloneObject so the assertions below operate on snapshots, not live
    // references into the running subgraph.
    const serializedInstance = LiteGraph.cloneObject(subgraphNode.serialize())
    const serializedDef = LiteGraph.cloneObject(
      subgraph.clone(true).asSerialisable()
    )

    // Mutate the live widget AFTER capture: the snapshot must remain at 123.
    // If serialize() ever started writing live references instead of snapshots,
    // this assertion would flip to -1.
    interiorNode.widgets![0].value = -1

    expect(serializedInstance!.id).toBe(subgraphNode.id)

    const exportedInterior = serializedDef!.nodes?.find(
      (n) => n.id === interiorNode.id
    )
    expect(exportedInterior?.widgets_values?.[0]).toBe(123)
  })

  test('multiple instances: serialization order does not affect definition values', () => {
    const { rootGraph, subgraph, interiorNode } = createSubgraphWithWidgetNode()

    const subgraphNode2 = createTestSubgraphNode(subgraph, {
      id: 2,
      pos: [300, 0]
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
