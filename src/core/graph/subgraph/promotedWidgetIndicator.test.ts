import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
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

function mountComponent(nodeData: VueNodeData, setupStores?: () => void) {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  setupStores?.()

  return mount(NodeWidgets, {
    props: { nodeData },
    global: {
      plugins: [pinia],
      stubs: { InputSlot: true },
      mocks: { $t: (key: string) => key }
    }
  })
}

function getBorderStyles(wrapper: ReturnType<typeof mount>) {
  return fromAny<{ processedWidgets: unknown[] }, unknown>(
    wrapper.vm
  ).processedWidgets.map(
    (entry) =>
      (entry as { simplified: { borderStyle?: string } }).simplified.borderStyle
  )
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
    const wrapper = mountComponent(nodeData, () => {
      // Store promotion WITHOUT disambiguatingSourceNodeId, as would
      // happen for a first-level nested promotion where the inner node
      // is not itself a SubgraphNode.
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text'
      })
    })
    await nextTick()
    const borderStyles = getBorderStyles(wrapper)

    expect(borderStyles.some((style) => style?.includes('promoted'))).toBe(true)
  })
})
