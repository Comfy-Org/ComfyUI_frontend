/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { asNodeId } from '@/lib/litegraph/src/litegraph'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

const GRAPH_ID = 'graph-test'

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

const WidgetStub = {
  name: 'WidgetStub',
  props: ['widget', 'nodeId', 'nodeType', 'modelValue'],
  template:
    '<div class="widget-stub" :data-node-type="nodeType">{{ nodeType }}</div>'
}

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry',
  async (importOriginal) => {
    const original = await importOriginal()
    return {
      ...(original as Record<string, unknown>),
      getComponent: () => WidgetStub
    }
  }
)

describe('NodeWidgets', () => {
  const createMockWidget = (
    overrides: Partial<SafeWidgetData> = {}
  ): SafeWidgetData => ({
    nodeId: asNodeId('test_node'),
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
    id: asNodeId(id),
    type: nodeType,
    widgets,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  })

  function renderComponent(nodeData?: VueNodeData, setupStores?: () => void) {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    setupStores?.()

    return render(NodeWidgets, {
      props: {
        nodeData
      },
      global: {
        plugins: [pinia],
        stubs: {
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
      const { container } = renderComponent(nodeData)

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe(
        'CheckpointLoaderSimple'
      )
    })

    it('renders no widgets when nodeData is undefined', () => {
      const { container } = renderComponent(undefined)

      expect(container.querySelectorAll('.widget-stub')).toHaveLength(0)
    })

    it('passes empty string when nodeData.type is empty', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('', [widget])
      const { container } = renderComponent(nodeData)

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe('')
    })
  })

  it('deduplicates widgets with identical render identity while keeping distinct promoted sources', () => {
    const duplicateEntityId = widgetId(
      GRAPH_ID,
      asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const distinctEntityId = widgetId(
      GRAPH_ID,
      asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:20'),
      'string_a'
    )
    const duplicateA = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: duplicateEntityId
    })
    const duplicateB = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: duplicateEntityId
    })
    const distinct = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:20'),
      widgetId: distinctEntityId
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      duplicateA,
      duplicateB,
      distinct
    ])

    const { container } = renderComponent(nodeData)

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('prefers a visible duplicate over a hidden duplicate when identities collide', () => {
    const sharedEntityId = widgetId(
      GRAPH_ID,
      asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const hiddenDuplicate = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: sharedEntityId,
      options: { hidden: true }
    })
    const visibleDuplicate = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: sharedEntityId,
      options: { hidden: false }
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      hiddenDuplicate,
      visibleDuplicate
    ])

    const { container } = renderComponent(nodeData)

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(1)
  })

  it('does not deduplicate entries that share names but have different widget types', () => {
    const sharedEntityId = widgetId(
      GRAPH_ID,
      asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const textWidget = createMockWidget({
      name: 'string_a',
      type: 'text',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: sharedEntityId
    })
    const comboWidget = createMockWidget({
      name: 'string_a',
      type: 'combo',
      nodeId: asNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      widgetId: sharedEntityId
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      textWidget,
      comboWidget
    ])

    const { container } = renderComponent(nodeData)

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('keeps unresolved same-name promoted entries distinct by source execution identity', () => {
    const firstTransientEntry = createMockWidget({
      nodeId: undefined,
      name: 'string_a',
      type: 'text',
      sourceExecutionId: '65:18'
    })
    const secondTransientEntry = createMockWidget({
      nodeId: undefined,
      name: 'string_a',
      type: 'text',
      sourceExecutionId: '65:19'
    })
    const nodeData = createMockNodeData('SubgraphNode', [
      firstTransientEntry,
      secondTransientEntry
    ])

    const { container } = renderComponent(nodeData)

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('does not deduplicate promoted duplicates that differ only by disambiguating source identity', () => {
    const firstPromoted = createMockWidget({
      name: 'text',
      type: 'text',
      nodeId: asNodeId('outer-subgraph:1'),
      widgetId: widgetId(GRAPH_ID, asNodeId('outer-subgraph:1'), 'text')
    })
    const secondPromoted = createMockWidget({
      name: 'text',
      type: 'text',
      nodeId: asNodeId('outer-subgraph:2'),
      widgetId: widgetId(GRAPH_ID, asNodeId('outer-subgraph:2'), 'text')
    })

    const nodeData = createMockNodeData('SubgraphNode', [
      firstPromoted,
      secondPromoted
    ])
    const { container } = renderComponent(nodeData)

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('hides widgets when merged store options mark them hidden', async () => {
    const nodeData = createMockNodeData('TestNode', [
      createMockWidget({
        nodeId: asNodeId('test_node'),
        name: 'test_widget',
        options: { hidden: false }
      })
    ])

    const { container } = renderComponent(nodeData)
    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.registerWidget(
      widgetId('graph-test', asNodeId('test_node'), 'test_widget'),
      {
        type: 'combo',
        value: 'value',
        options: { hidden: true },
        label: undefined,
        serialize: true,
        disabled: false
      }
    )

    await nextTick()

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(0)
  })

  it('forwards canonical widgetId to AppInput for selection', () => {
    const seedAEntityId = widgetId(GRAPH_ID, asNodeId('test_node'), 'seed_a')
    const seedBEntityId = widgetId(GRAPH_ID, asNodeId('test_node'), 'seed_b')
    const nodeData = createMockNodeData('TestNode', [
      createMockWidget({
        nodeId: asNodeId('test_node'),
        name: 'seed_a',
        type: 'text',
        widgetId: seedAEntityId
      }),
      createMockWidget({
        nodeId: asNodeId('test_node'),
        name: 'seed_b',
        type: 'text',
        widgetId: seedBEntityId
      })
    ])

    const { container } = render(NodeWidgets, {
      props: { nodeData },
      global: {
        plugins: [
          (() => {
            const pinia = createTestingPinia({ stubActions: false })
            setActivePinia(pinia)
            return pinia
          })()
        ],
        stubs: {
          InputSlot: true,
          AppInput: {
            props: ['widgetId', 'name', 'enable'],
            template:
              '<div class="app-input-stub" :data-entity-id="widgetId"><slot /></div>'
          }
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })
    const appInputElements = container.querySelectorAll('.app-input-stub')
    const ids = Array.from(appInputElements).map((el) =>
      el.getAttribute('data-entity-id')
    )

    expect(ids).toStrictEqual([seedAEntityId, seedBEntityId])
  })
})
