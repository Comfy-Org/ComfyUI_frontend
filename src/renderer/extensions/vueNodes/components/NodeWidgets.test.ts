import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { fromAny } from '@total-typescript/shoehorn'

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

describe('NodeWidgets', () => {
  const createMockWidget = (
    overrides: Partial<SafeWidgetData> = {}
  ): SafeWidgetData => ({
    nodeId: 'test_node',
    name: 'test_widget',
    type: 'combo',
    options: undefined,
    callback: undefined,
    spec: undefined,
    isDOMWidget: false,
    slotMetadata: undefined,
    ...overrides
  })

  const createMockNodeData = (
    nodeType: string = 'TestNode',
    widgets: SafeWidgetData[] = [],
    id: string = '1'
  ): VueNodeData => ({
    id,
    type: nodeType,
    widgets,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  })

  const mountComponent = (nodeData?: VueNodeData, setupStores?: () => void) => {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    setupStores?.()

    return mount(NodeWidgets, {
      props: {
        nodeData
      },
      global: {
        plugins: [pinia],
        stubs: {
          // Stub InputSlot to avoid complex slot registration dependencies
          InputSlot: true
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  const getBorderStyles = (wrapper: ReturnType<typeof mount>) =>
    fromAny<{ processedWidgets: unknown[] }, unknown>(
      wrapper.vm
    ).processedWidgets.map(
      (entry) =>
        (
          entry as {
            simplified: {
              borderStyle?: string
            }
          }
        ).simplified.borderStyle
    )

  describe('node-type prop passing', () => {
    it('passes node type to widget components', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('CheckpointLoaderSimple', [widget])
      const wrapper = mountComponent(nodeData)

      // Find the dynamically rendered widget component
      const widgetComponent = wrapper.find('.lg-node-widget')
      expect(widgetComponent.exists()).toBe(true)

      // Verify node-type prop is passed
      const component = widgetComponent.findComponent({ name: 'WidgetSelect' })
      if (component.exists()) {
        expect(component.props('nodeType')).toBe('CheckpointLoaderSimple')
      }
    })

    it('passes empty string when nodeData is undefined', () => {
      const wrapper = mountComponent(undefined)

      // No widgets should be rendered
      const widgetComponents = wrapper.findAll('.lg-node-widget')
      expect(widgetComponents).toHaveLength(0)
    })

    it('passes empty string when nodeData.type is undefined', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('', [widget])
      const wrapper = mountComponent(nodeData)

      const widgetComponent = wrapper.find('.lg-node-widget')
      if (widgetComponent.exists()) {
        const component = widgetComponent.findComponent({
          name: 'WidgetSelect'
        })
        if (component.exists()) {
          expect(component.props('nodeType')).toBe('')
        }
      }
    })

    it.for(['CheckpointLoaderSimple', 'LoraLoader', 'VAELoader', 'KSampler'])(
      'passes correct node type: %s',
      (nodeType) => {
        const widget = createMockWidget()
        const nodeData = createMockNodeData(nodeType, [widget])
        const wrapper = mountComponent(nodeData)

        const widgetComponent = wrapper.find('.lg-node-widget')
        expect(widgetComponent.exists()).toBe(true)

        const component = widgetComponent.findComponent({
          name: 'WidgetSelect'
        })
        if (component.exists()) {
          expect(component.props('nodeType')).toBe(nodeType)
        }
      }
    )
  })

  it('deduplicates widgets with identical render identity while keeping distinct promoted sources', () => {
    const duplicateA = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a'
    })
    const duplicateB = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a'
    })
    const distinct = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:20',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:20',
      storeName: 'string_a',
      slotName: 'string_a'
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      duplicateA,
      duplicateB,
      distinct
    ])

    const wrapper = mountComponent(nodeData)

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(2)
  })

  it('prefers a visible duplicate over a hidden duplicate when identities collide', () => {
    const hiddenDuplicate = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a',
      options: { hidden: true }
    })
    const visibleDuplicate = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a',
      options: { hidden: false }
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      hiddenDuplicate,
      visibleDuplicate
    ])

    const wrapper = mountComponent(nodeData)

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(1)
  })

  it('does not deduplicate entries that share names but have different widget types', () => {
    const textWidget = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a'
    })
    const comboWidget = createMockWidget({
      name: 'string_a',
      type: 'combo',
      nodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeNodeId: '5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19',
      storeName: 'string_a',
      slotName: 'string_a'
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      textWidget,
      comboWidget
    ])

    const wrapper = mountComponent(nodeData)

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(2)
  })

  it('keeps unresolved same-name promoted entries distinct by source execution identity', () => {
    const firstTransientEntry = createMockWidget({
      nodeId: undefined,
      storeNodeId: undefined,
      name: 'string_a',
      storeName: 'string_a',
      slotName: 'string_a',
      type: 'text',
      sourceExecutionId: '65:18'
    })
    const secondTransientEntry = createMockWidget({
      nodeId: undefined,
      storeNodeId: undefined,
      name: 'string_a',
      storeName: 'string_a',
      slotName: 'string_a',
      type: 'text',
      sourceExecutionId: '65:19'
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      firstTransientEntry,
      secondTransientEntry
    ])

    const wrapper = mountComponent(nodeData)

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(2)
  })

  it('does not deduplicate promoted duplicates that differ only by disambiguating source identity', () => {
    const firstPromoted = createMockWidget({
      name: 'text',
      type: 'text',
      nodeId: 'outer-subgraph:1',
      storeNodeId: 'outer-subgraph:1',
      storeName: 'text',
      slotName: 'text'
    })
    const secondPromoted = createMockWidget({
      name: 'text',
      type: 'text',
      nodeId: 'outer-subgraph:2',
      storeNodeId: 'outer-subgraph:2',
      storeName: 'text',
      slotName: 'text'
    })

    const nodeData = createMockNodeData('SubgraphNode', [
      firstPromoted,
      secondPromoted
    ])
    const wrapper = mountComponent(nodeData)

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(2)
  })

  it('applies promoted border styling to intermediate promoted widgets using host node identity', async () => {
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
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
    })
    await nextTick()
    const borderStyles = getBorderStyles(wrapper)

    expect(borderStyles.some((style) => style?.includes('promoted'))).toBe(true)
  })

  it('does not apply promoted border styling to outermost widgets', async () => {
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: 'inner-subgraph:1',
      storeNodeId: 'inner-subgraph:1',
      storeName: 'text',
      slotName: 'text'
    })
    const nodeData = createMockNodeData('SubgraphNode', [promotedWidget], '4')
    const wrapper = mountComponent(nodeData, () => {
      usePromotionStore().promote('graph-test', '4', {
        sourceNodeId: '3',
        sourceWidgetName: 'text',
        disambiguatingSourceNodeId: '1'
      })
    })
    await nextTick()
    const borderStyles = getBorderStyles(wrapper)

    expect(borderStyles.some((style) => style?.includes('promoted'))).toBe(
      false
    )
  })

  it('hides widgets when merged store options mark them hidden', async () => {
    const nodeData = createMockNodeData('TestNode', [
      createMockWidget({
        nodeId: 'test_node',
        name: 'test_widget',
        options: { hidden: false }
      })
    ])

    const wrapper = mountComponent(nodeData)
    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.registerWidget('graph-test', {
      nodeId: 'test_node',
      name: 'test_widget',
      type: 'combo',
      value: 'value',
      options: { hidden: true },
      label: undefined,
      serialize: true,
      disabled: false
    })

    await nextTick()

    expect(wrapper.findAll('.lg-node-widget')).toHaveLength(0)
  })

  it('keeps AppInput ids mapped to node identity for selection', () => {
    const nodeData = createMockNodeData('TestNode', [
      createMockWidget({ nodeId: 'test_node', name: 'seed_a', type: 'text' }),
      createMockWidget({ nodeId: 'test_node', name: 'seed_b', type: 'text' })
    ])

    const wrapper = mountComponent(nodeData)
    const appInputWrappers = wrapper.findAllComponents({ name: 'AppInput' })
    const ids = appInputWrappers.map((component) => component.props('id'))

    expect(ids).toStrictEqual(['test_node', 'test_node'])
  })
})
