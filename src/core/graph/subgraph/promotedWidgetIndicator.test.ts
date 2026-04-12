import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { describe, expect, test, vi } from 'vitest'

import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { usePromotionStore } from '@/stores/promotionStore'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        rootGraph: {
          id: 'graph-test'
        }
      }
    }
  })
}))

const PROMOTED_CLASS = 'ring-component-node-widget-promoted'

const WidgetStub = defineComponent({
  props: { widget: { type: Object, default: undefined } },
  setup(props) {
    return () =>
      h('div', {
        'data-testid': 'widget-stub',
        class: props.widget?.borderStyle
      })
  }
})

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry',
  () => ({
    getComponent: () => WidgetStub,
    shouldExpand: () => false,
    shouldRenderAsVue: () => true
  })
)

function createMockWidget(
  overrides: Partial<SafeWidgetData> = {}
): SafeWidgetData {
  return {
    nodeId: 'test_node',
    name: 'test_widget',
    type: 'combo',
    options: undefined,
    callback: undefined,
    spec: undefined,
    isDOMWidget: false,
    slotMetadata: undefined,
    ...overrides
  }
}

function createMockNodeData(
  nodeType: string,
  widgets: SafeWidgetData[],
  id: string
): VueNodeData {
  return {
    id,
    type: nodeType,
    widgets,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  }
}

function renderComponent(nodeData: VueNodeData, setupStores?: () => void) {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  setupStores?.()

  return render(NodeWidgets, {
    props: { nodeData },
    global: {
      plugins: [pinia],
      stubs: { InputSlot: true },
      mocks: { $t: (key: string) => key }
    }
  })
}

describe('promoted widget indicator on nested subgraphs', () => {
  test('shows promoted ring when promotion includes disambiguatingSourceNodeId', async () => {
    // Scenario: SubBNode (id=3) inside SubA promotes a widget from
    // ConcreteNode (id=1). During hydration, SubgraphNode.configure
    // resolves the concrete node and stores the promotion WITH
    // disambiguatingSourceNodeId so that the exact key matches the
    // renderer's lookup.
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: 'inner-subgraph:1',
      storeNodeId: 'inner-subgraph:1',
      storeName: 'text',
      slotName: 'text'
    })
    const nodeData = createMockNodeData('SubgraphNode', [promotedWidget], '3')
    renderComponent(nodeData, () => {
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
    })

    const widgets = screen.getAllByTestId('widget-stub')
    const hasPromotedRing = widgets.some((el) =>
      el.classList.contains(PROMOTED_CLASS)
    )
    expect(hasPromotedRing).toBe(true)
  })

  test('shows promoted ring via base-key lookup when disambiguator is unknown', async () => {
    // Legacy callers (e.g. BaseWidget) may not have the disambiguator.
    // The dual-indexed base key ensures the ring still shows.
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: 'test_node',
      isDOMWidget: false
    })
    const nodeData = createMockNodeData('SubgraphNode', [promotedWidget], '3')
    renderComponent(nodeData, () => {
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
    })

    const widgets = screen.getAllByTestId('widget-stub')
    const hasPromotedRing = widgets.some((el) =>
      el.classList.contains(PROMOTED_CLASS)
    )
    expect(hasPromotedRing).toBe(true)
  })
})
