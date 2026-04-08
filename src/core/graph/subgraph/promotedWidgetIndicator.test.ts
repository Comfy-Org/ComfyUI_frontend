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
  test('shows promoted ring when promotion was stored without disambiguatingSourceNodeId', async () => {
    // Scenario: SubBNode (id=3) inside SubA promotes a widget from
    // ConcreteNode (id=1). The promotion at the SubA level is stored
    // WITHOUT disambiguatingSourceNodeId because ConcreteNode is not
    // itself a SubgraphNode.
    //
    // The widget rendered on SubBNode has storeName and storeNodeId set
    // (because it's a promoted widget), so NodeWidgets.vue would normally
    // compute a disambiguatingSourceNodeId from the storeNodeId.
    // This causes a key mismatch: lookup key "3:text:1" vs stored "3:text".
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
      // Store promotion WITHOUT disambiguatingSourceNodeId, as would
      // happen for a first-level nested promotion where the inner node
      // is not itself a SubgraphNode.
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text'
      })
    })

    const widgets = screen.getAllByTestId('widget-stub')
    const hasPromotedRing = widgets.some((el) =>
      el.classList.contains(PROMOTED_CLASS)
    )
    expect(hasPromotedRing).toBe(true)
  })
})
