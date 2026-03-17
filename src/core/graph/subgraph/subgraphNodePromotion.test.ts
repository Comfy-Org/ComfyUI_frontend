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
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
    )
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      usePromotionStore().getPromotions(
        subgraphNode.rootGraph.id,
        subgraphNode.id
      )
    ).toStrictEqual([
      { interiorNodeId: innerIds[0], widgetName: 'stringWidget' }
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
        { interiorNodeId: innerIds[0], widgetName: 'stringWidget' },
        { interiorNodeId: innerIds[1], widgetName: 'stringWidget' }
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
      { interiorNodeId: innerIds[0], widgetName: 'widgetA' },
      { interiorNodeId: innerIds[0], widgetName: 'widgetB' }
    ])
    expect(subgraphNode.widgets.length).toBe(2)
    expect(subgraphNode.widgets[0].name).toBe('widgetA')
    expect(subgraphNode.widgets[1].name).toBe('widgetB')

    // Reorder
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { interiorNodeId: innerIds[0], widgetName: 'widgetB' },
      { interiorNodeId: innerIds[0], widgetName: 'widgetA' }
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
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
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
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
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
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
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
    store.promote(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      innerIds[0],
      'stringWidget'
    )
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toHaveLength(1)

    // Try to promote again - should not create duplicate
    store.promote(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      innerIds[0],
      'stringWidget'
    )
    expect(subgraphNode.widgets.length).toBe(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toHaveLength(1)
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toStrictEqual([
      { interiorNodeId: innerIds[0], widgetName: 'stringWidget' }
    ])
  })

  test('removeWidget removes from promotion list and view cache', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    const store = usePromotionStore()
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    store.setPromotions(subgraphNode.rootGraph.id, subgraphNode.id, [
      { interiorNodeId: innerIds[0], widgetName: 'widgetA' },
      { interiorNodeId: innerIds[0], widgetName: 'widgetB' }
    ])
    expect(subgraphNode.widgets).toHaveLength(2)

    const widgetToRemove = subgraphNode.widgets[0]
    subgraphNode.removeWidget(widgetToRemove)

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
    expect(
      store.getPromotions(subgraphNode.rootGraph.id, subgraphNode.id)
    ).toStrictEqual([{ interiorNodeId: innerIds[0], widgetName: 'widgetB' }])
  })

  test('removeWidgetByName removes from promotion list', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [
        { interiorNodeId: innerIds[0], widgetName: 'widgetA' },
        { interiorNodeId: innerIds[0], widgetName: 'widgetB' }
      ]
    )

    subgraphNode.removeWidgetByName('widgetA')

    expect(subgraphNode.widgets).toHaveLength(1)
    expect(subgraphNode.widgets[0].name).toBe('widgetB')
  })

  test('removeWidget cleans up input references', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
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

  test('serialize does not produce widgets_values for promoted views', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [{ interiorNodeId: innerIds[0], widgetName: 'stringWidget' }]
    )
    expect(subgraphNode.widgets).toHaveLength(1)

    const serialized = subgraphNode.serialize()

    // SubgraphNode doesn't set serialize_widgets, so widgets_values is absent.
    // Even if it were set, views have serialize: false and would be skipped.
    expect(serialized.widgets_values).toBeUndefined()
  })

  test('serialize preserves proxyWidgets in properties', () => {
    const [subgraphNode, innerNodes, innerIds] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'widgetA', 'a', () => {})
    innerNodes[0].addWidget('text', 'widgetB', 'b', () => {})
    usePromotionStore().setPromotions(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      [
        { interiorNodeId: innerIds[0], widgetName: 'widgetA' },
        { interiorNodeId: innerIds[0], widgetName: 'widgetB' }
      ]
    )

    const serialized = subgraphNode.serialize()

    expect(serialized.properties?.proxyWidgets).toStrictEqual([
      [innerIds[0], 'widgetA'],
      [innerIds[0], 'widgetB']
    ])
  })
})
