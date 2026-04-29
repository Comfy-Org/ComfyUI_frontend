import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { usePromotionStore } from '@/stores/promotionStore'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function setupSubgraph(
  innerNodeCount: number = 0
): [SubgraphNode, LGraphNode[], string[]] {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  subgraphNode._internalConfigureAfterSlots()
  const graph = subgraphNode.graph!
  graph.add(subgraphNode)
  const innerNodes: LGraphNode[] = []
  for (let i = 0; i < innerNodeCount; i++) {
    const innerNode = new LGraphNode(`InnerNode${i}`)
    subgraph.add(innerNode)
    innerNodes.push(innerNode)
  }
  const innerIds = innerNodes.map((n) => String(n.id))
  return [subgraphNode, innerNodes, innerIds]
}

describe('Subgraph proxyWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  test('Can add simple widget', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      usePromotionStore().getPromotions(
        subgraphNode.rootGraph.id,
        subgraphNode.id
      )
    ).toStrictEqual([
      { sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }
    ])
  })
  test('Can add multiple widgets with same name', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(2)
    for (const innerNode of innerNodes)
      innerNode.addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [
        { sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' },
        { sourceNodeId: innerIds[1], sourceWidgetName: 'stringWidget' }
      ]
    )
    expect(subgraphNode.widgets.length).toBe(2)
    // Both views share the widget name; they're distinguished by sourceNodeId
    expect(subgraphNode.widgets[0].name).toBe('stringWidget')
    expect(subgraphNode.widgets[1].name).toBe('stringWidget')
  })
  test('Will reflect proxyWidgets order changes', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    const store = usePromotionStore()
    innerNodes[0].addWidget('text', 'widgetA', 'value', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'value', () => {})

    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetA' },
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' }
    ])
    expect(subgraphNode.widgets.length).toBe(2)
    expect(subgraphNode.widgets[0].name).toBe('widgetA')
    expect(subgraphNode.widgets[1].name).toBe('widgetB')

    // Reorder
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' },
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetA' }
    ])
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    expect(subgraphNode.widgets[1].name).toBe('widgetA')
  })
  test('Will mirror changes to value', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )
    expect(subgraphNode.widgets.length).toBe(1)
    expect(subgraphNode.widgets[0].value).toBe('value')
    innerNodes[0].widgets![0].value = 'test'
    expect(subgraphNode.widgets[0].value).toBe('test')
    subgraphNode.widgets[0].value = 'test2'
    expect(innerNodes[0].widgets![0].value).toBe('test2')
  })
  test('Will not modify position or sizing of existing widgets', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )
    if (!innerNodes[0].widgets) throw new Error('node has no widgets')
    innerNodes[0].widgets[0].y = 10
    innerNodes[0].widgets[0].last_y = 11
    innerNodes[0].widgets[0].computedHeight = 12
    subgraphNode.widgets[0].y = 20
    subgraphNode.widgets[0].last_y = 21
    subgraphNode.widgets[0].computedHeight = 22
    expect(innerNodes[0].widgets[0].y).toBe(10)
    expect(innerNodes[0].widgets[0].last_y).toBe(11)
    expect(innerNodes[0].widgets[0].computedHeight).toBe(12)
  })
  test('Renders placeholder when interior widget is detached', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )
    if (!innerNodes[0].widgets) throw new Error('node has no widgets')

    // View resolves the interior widget's type
    expect(subgraphNode.widgets[0].type).toBe('text')

    // Remove interior widget — view falls back to disconnected state
    innerNodes[0].widgets.pop()
    expect(subgraphNode.widgets[0].type).toBe('button')

    // Re-add — view resolves again
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    expect(subgraphNode.widgets[0].type).toBe('text')
  })
  test('Prevents duplicate promotion', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    const store = usePromotionStore()
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})

    // Promote once
    store.promote(subgraphNode.rootGraph.id, subgraphNode.id, {
      sourceNodeId: innerIds[0],
      sourceWidgetName: 'stringWidget'
    })
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toHaveLength(1)

    // Try to promote again - should not create duplicate
    store.promote(subgraphNode.rootGraph.id, subgraphNode.id, {
      sourceNodeId: innerIds[0],
      sourceWidgetName: 'stringWidget'
    })
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toHaveLength(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toStrictEqual([
      { sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }
    ])
  })

  test('removeWidget removes from promotion list and view cache', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    const store = usePromotionStore()
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetA' },
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' }
    ])
    expect(subgraphNode.widgets).toHaveLength(2)

    const widgetToRemove = subgraphNode.widgets[0]
    subgraphNode.removeWidget(widgetToRemove)

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toStrictEqual([
      { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' }
    ])
  })

  test('removeWidget removes from promotion list', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [
        { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetA' },
        { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' }
      ]
    )

    const widgetA = subgraphNode.widgets.find((w) => w.name === 'widgetA')!
    subgraphNode.removeWidget(widgetA)

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
  })

  test('removeWidget cleans up input references', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )

    const view = subgraphNode.widgets[0]
    // Simulate an input referencing the widget
    subgraphNode.addInput('stringWidget', '*')
    const input = subgraphNode.inputs[subgraphNode.inputs.length - 1]
    input._widget = view

    subgraphNode.removeWidget(view)

    expect(input._widget).toBeUndefined()
    expect(subgraphNode.widgets).toHaveLength(0)
  })

  test('serialize stores widgets_values for promoted views', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }]
    )
    expect(subgraphNode.widgets).toHaveLength(1)

    const serialized = subgraphNode.serialize()

    expect(serialized.widgets_values).toEqual(['value'])
  })

  test('serialize preserves proxyWidgets in properties', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [
        { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetA' },
        { sourceNodeId: innerIds[0], sourceWidgetName: 'widgetB' }
      ]
    )

    const serialized = subgraphNode.serialize()

    expect(serialized.properties?.proxyWidgets).toStrictEqual([
      [innerIds[0], 'widgetA'],
      [innerIds[0], 'widgetB']
    ])
  })

  test('multi-link representative is deterministic across repeated reads', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'shared_input', type: '*' }]
    })
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode._internalConfigureAfterSlots()
    subgraphNode.graph!.add(subgraphNode)

    const nodeA = new LGraphNode('NodeA')
    const inputA = nodeA.addInput('shared_input', '*')
    nodeA.addWidget('text', 'shared_input', 'first', () => {})
    inputA.widget = { name: 'shared_input' }
    subgraph.add(nodeA)

    const nodeB = new LGraphNode('NodeB')
    const inputB = nodeB.addInput('shared_input', '*')
    nodeB.addWidget('text', 'shared_input', 'second', () => {})
    inputB.widget = { name: 'shared_input' }
    subgraph.add(nodeB)

    const nodeC = new LGraphNode('NodeC')
    const inputC = nodeC.addInput('shared_input', '*')
    nodeC.addWidget('text', 'shared_input', 'third', () => {})
    inputC.widget = { name: 'shared_input' }
    subgraph.add(nodeC)

    subgraph.inputNode.slots[0].connect(inputA, nodeA)
    subgraph.inputNode.slots[0].connect(inputB, nodeB)
    subgraph.inputNode.slots[0].connect(inputC, nodeC)

    const firstRead = subgraphNode.widgets.map((w) => w.value)
    const secondRead = subgraphNode.widgets.map((w) => w.value)
    const thirdRead = subgraphNode.widgets.map((w) => w.value)

    expect(firstRead).toStrictEqual(secondRead)
    expect(secondRead).toStrictEqual(thirdRead)
    expect(subgraphNode.widgets[0].value).toBe('first')
  })

  test('3-level nested promotion resolves concrete widget type and value', () => {
    usePromotionStore()

    // Level C: innermost subgraph with a concrete widget
    const subgraphC = createTestSubgraph({
      inputs: [{ name: 'deep_input', type: '*' }]
    })
    const concreteNode = new LGraphNode('ConcreteNode')
    const concreteInput = concreteNode.addInput('deep_input', '*')
    concreteNode.addWidget('number', 'deep_input', 42, () => {})
    concreteInput.widget = { name: 'deep_input' }
    subgraphC.add(concreteNode)
    subgraphC.inputNode.slots[0].connect(concreteInput, concreteNode)

    const subgraphNodeC = createTestSubgraphNode(subgraphC, { id: 301 })

    // Level B: middle subgraph containing C
    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'mid_input', type: '*' }]
    })
    subgraphB.add(subgraphNodeC)
    subgraphNodeC._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeC.inputs[0], subgraphNodeC)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 302 })

    // Level A: outermost subgraph containing B
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'outer_input', type: '*' }]
    })
    subgraphA.add(subgraphNodeB)
    subgraphNodeB._internalConfigureAfterSlots()
    subgraphA.inputNode.slots[0].connect(subgraphNodeB.inputs[0], subgraphNodeB)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 303 })

    // Outermost promoted widget should resolve through all 3 levels
    expect(subgraphNodeA.widgets).toHaveLength(1)
    expect(subgraphNodeA.widgets[0].type).toBe('number')
    expect(subgraphNodeA.widgets[0].value).toBe(42)

    // Setting value at outermost level propagates to concrete widget
    subgraphNodeA.widgets[0].value = 99
    expect(concreteNode.widgets![0].value).toBe(99)
  })

  test('removeWidget cleans up promotion and input, then re-promote works', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    const store = usePromotionStore()
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }
    ])

    const view = subgraphNode.widgets[0]
    subgraphNode.addInput('stringWidget', '*')
    const input = subgraphNode.inputs[subgraphNode.inputs.length - 1]
    input._widget = view

    // Remove: should clean up store AND input reference
    subgraphNode.removeWidget(view)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toHaveLength(0)
    expect(input._widget).toBeUndefined()
    expect(subgraphNode.widgets).toHaveLength(0)

    // Re-promote: should work correctly after cleanup
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { sourceNodeId: innerIds[0], sourceWidgetName: 'stringWidget' }
    ])
    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].type).toBe('text')
    expect(subgraphNode.widgets[0].value).toBe('value')
  })
})
