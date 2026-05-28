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

import { isPromotedWidgetView } from './promotedWidgetTypes'

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

    const viewA = hostA.widgets.find(isPromotedWidgetView)
    const viewB = hostB.widgets.find(isPromotedWidgetView)
    if (!viewA || !viewB)
      throw new Error('Expected promoted views on both hosts')

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
    widgetStore.registerWidget(subgraph.rootGraph.id, {
      nodeId: String(interior.id),
      name: 'widget',
      type: 'number',
      value: 42,
      options: {},
      label: undefined,
      serialize: true,
      disabled: false
    })

    const host = createTestSubgraphNode(subgraph, { id: 200 })
    const view = host.widgets.find(isPromotedWidgetView)
    if (!view) throw new Error('Expected promoted view on host')

    view.value = 99

    const interiorState = widgetStore._lookupWidgetState(
      subgraph.rootGraph.id,
      String(interior.id),
      'widget'
    )
    expect(interiorState?.value).toBe(42)
  })
})
