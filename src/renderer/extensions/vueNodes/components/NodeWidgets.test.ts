/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import type { NodeState } from '@/types/nodeState'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

const GRAPH_ID = 'graph-test'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    rootGraphId: GRAPH_ID
  })
}))

const WidgetStub = {
  name: 'WidgetStub',
  props: ['widget', 'nodeId', 'nodeType', 'modelValue'],
  template:
    '<div class="widget-stub" :data-node-type="nodeType" :data-name="widget.name">{{ nodeType }}</div>'
}

const AppInputStub = {
  props: ['widgetId', 'name', 'enable'],
  template:
    '<div class="app-input-stub" :data-entity-id="widgetId"><slot /></div>'
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

function createMockNodeData(
  nodeType = 'TestNode',
  id: NodeId = toNodeId(1)
): NodeState {
  return {
    id,
    graphId: 'test-graph',
    type: nodeType,
    title: 'Test Node',
    mode: 0,
    flags: {}
  }
}

function registerWidgetState(
  id: WidgetId,
  init: {
    type?: string
    value?: unknown
    options?: Record<string, unknown>
  } = {}
) {
  useWidgetValueStore().registerWidget(id, {
    type: init.type ?? 'combo',
    value: init.value ?? 'value',
    options: init.options ?? {}
  })
}

function renderComponent({
  nodeData,
  widgetIds,
  setupStores
}: {
  nodeData?: NodeState
  widgetIds?: readonly WidgetId[]
  setupStores?: () => void
}) {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  setupStores?.()

  return render(NodeWidgets, {
    props: {
      nodeData,
      widgetIds
    },
    global: {
      plugins: [pinia],
      stubs: {
        InputSlot: true,
        AppInput: AppInputStub
      },
      mocks: {
        $t: (key: string) => key
      }
    }
  })
}

describe('NodeWidgets', () => {
  describe('node-type prop passing', () => {
    it('passes node type to widget components', () => {
      const id = widgetId(GRAPH_ID, toNodeId(1), 'test_widget')
      const nodeData = createMockNodeData('CheckpointLoaderSimple')
      const { container } = renderComponent({
        nodeData,
        widgetIds: [id],
        setupStores: () => registerWidgetState(id)
      })

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe(
        'CheckpointLoaderSimple'
      )
    })

    it('renders no widgets when nodeData is undefined', () => {
      const id = widgetId(GRAPH_ID, toNodeId(1), 'test_widget')
      const { container } = renderComponent({
        widgetIds: [id],
        setupStores: () => registerWidgetState(id)
      })

      expect(container.querySelectorAll('.widget-stub')).toHaveLength(0)
    })

    it('renders no widgets when no widget ids are registered or passed', () => {
      const { container } = renderComponent({
        nodeData: createMockNodeData('CheckpointLoaderSimple')
      })

      expect(container.querySelectorAll('.widget-stub')).toHaveLength(0)
    })

    it('passes empty string when nodeData.type is empty', () => {
      const id = widgetId(GRAPH_ID, toNodeId(1), 'test_widget')
      const nodeData = createMockNodeData('')
      const { container } = renderComponent({
        nodeData,
        widgetIds: [id],
        setupStores: () => registerWidgetState(id)
      })

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe('')
    })
  })

  it('derives widget ids from the store when ids are not passed', () => {
    const nodeId = toNodeId('test_node')
    const id = widgetId(GRAPH_ID, nodeId, 'test_widget')
    const { container } = renderComponent({
      nodeData: createMockNodeData('TestNode', nodeId),
      setupStores: () => registerWidgetState(id)
    })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(1)
  })

  it('deduplicates repeated widget ids while keeping distinct widget ids', () => {
    const duplicateEntityId = widgetId(
      GRAPH_ID,
      toNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const distinctEntityId = widgetId(
      GRAPH_ID,
      toNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:20'),
      'string_a'
    )
    const nodeData = createMockNodeData('SubgraphNode')

    const { container } = renderComponent({
      nodeData,
      widgetIds: [duplicateEntityId, duplicateEntityId, distinctEntityId],
      setupStores: () => {
        registerWidgetState(duplicateEntityId, { type: 'text' })
        registerWidgetState(distinctEntityId, { type: 'text' })
      }
    })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('hides widgets when store options mark them hidden', () => {
    const nodeData = createMockNodeData('TestNode', toNodeId('test_node'))
    const id = widgetId(GRAPH_ID, toNodeId('test_node'), 'test_widget')

    const { container } = renderComponent({
      nodeData,
      widgetIds: [id],
      setupStores: () => {
        registerWidgetState(id, {
          type: 'combo',
          options: { hidden: true }
        })
      }
    })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(0)
  })

  it('forwards canonical widgetId to AppInput for selection', () => {
    const seedAEntityId = widgetId(GRAPH_ID, toNodeId('test_node'), 'seed_a')
    const seedBEntityId = widgetId(GRAPH_ID, toNodeId('test_node'), 'seed_b')
    const nodeData = createMockNodeData('TestNode', toNodeId('test_node'))

    const { container } = renderComponent({
      nodeData,
      widgetIds: [seedAEntityId, seedBEntityId],
      setupStores: () => {
        registerWidgetState(seedAEntityId, { type: 'text' })
        registerWidgetState(seedBEntityId, { type: 'text' })
      }
    })

    const appInputElements = container.querySelectorAll('.app-input-stub')
    const ids = Array.from(appInputElements).map((el) =>
      el.getAttribute('data-entity-id')
    )

    expect(ids).toStrictEqual([seedAEntityId, seedBEntityId])
  })

  it('marks widgets with host execution errors', () => {
    const nodeId = toNodeId('test_node')
    const id = widgetId(GRAPH_ID, nodeId, 'seed')

    const { container } = renderComponent({
      nodeData: createMockNodeData('TestNode', nodeId),
      widgetIds: [id],
      setupStores: () => {
        useExecutionErrorStore().lastNodeErrors = {
          [createNodeExecutionId([nodeId])]: {
            errors: [
              {
                type: 'value_not_in_list',
                message: 'seed is invalid',
                details: '',
                extra_info: { input_name: 'seed' }
              }
            ],
            class_type: 'TestNode',
            dependent_outputs: []
          }
        }
        registerWidgetState(id, { type: 'text' })
      }
    })

    expect(container.querySelector('.widget-stub')?.className).toContain(
      'text-node-stroke-error'
    )
  })
})
