import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'

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
    widgets: SafeWidgetData[] = []
  ): VueNodeData => ({
    id: '1',
    type: nodeType,
    widgets,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  })

  const mountComponent = (nodeData?: VueNodeData) => {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)

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
