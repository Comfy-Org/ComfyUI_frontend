import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { createPromotedWidgetView } from './promotedWidgetView'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

function createNumericInteriorNode(initialValue: number) {
  const node = new LGraphNode('Interior')
  const input = node.addInput('value', 'number')
  node.addOutput('out', 'number')

  const widget = node.addWidget('number', 'widget', initialValue, () => {}, {
    min: 0,
    max: 100,
    step: 1
  })
  input.widget = { name: widget.name }

  return { node, widget }
}

describe('PromotedWidgetView — host-wins semantics', () => {
  it('does not leak host-side writes into the interior widget or into a sibling host', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    const { node: interior, widget: interiorWidget } =
      createNumericInteriorNode(42)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

    const hostA = createTestSubgraphNode(subgraph, { id: 100 })
    const hostB = createTestSubgraphNode(subgraph, { id: 101 })

    const viewA = createPromotedWidgetView(
      hostA,
      String(interior.id),
      'widget',
      'value',
      'value'
    )
    const viewB = createPromotedWidgetView(
      hostB,
      String(interior.id),
      'widget',
      'value',
      'value'
    )

    viewA.value = 7

    expect(viewA.value).toBe(7)
    expect(interiorWidget.value).toBe(42)
    expect(viewB.value).toBe(42)
  })

  it('keeps the interior widgetValueStore row untouched when a host writes', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    const { node: interior } = createNumericInteriorNode(42)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

    const widgetStore = useWidgetValueStore()
    widgetStore.registerWidget(
      widgetId(subgraph.rootGraph.id, interior.id, 'widget'),
      {
        type: 'number',
        value: 42,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      }
    )

    const host = createTestSubgraphNode(subgraph, { id: 200 })
    const view = createPromotedWidgetView(
      host,
      String(interior.id),
      'widget',
      'value',
      'value'
    )

    view.value = 99

    const interiorState = widgetStore.getWidget(
      widgetId(subgraph.rootGraph.id, interior.id, 'widget')
    )
    expect(interiorState?.value).toBe(42)
  })
})
