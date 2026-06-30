/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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
    canvas: {
      graph: {
        rootGraph: {
          id: GRAPH_ID
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

function createMockWidget(
  overrides: Partial<IBaseWidget> & { widgetId?: WidgetId } = {}
): IBaseWidget {
  const { widgetId: id, ...rest } = overrides
  const widget: IBaseWidget = {
    name: 'test_widget',
    type: 'combo',
    options: {},
    value: 'value',
    y: 0,
    ...rest
  }
  if (id) {
    Object.defineProperty(widget, 'widgetId', {
      value: id,
      configurable: true
    })
  }
  return widget
}

function createMockNode(
  widgets: IBaseWidget[],
  id: NodeId = toNodeId(1),
  type = 'TestNode'
): LGraphNode {
  const node = new LGraphNode(type)
  node.id = id
  node.type = type
  node.widgets = widgets
  return node
}

function createMockNodeData(
  nodeType = 'TestNode',
  id: NodeId = toNodeId(1)
): VueNodeData {
  return {
    id,
    type: nodeType,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  }
}

function renderComponent({
  nodeData,
  node,
  setupStores
}: {
  nodeData?: VueNodeData
  node?: LGraphNode | null
  setupStores?: () => void
}) {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  setupStores?.()

  return render(NodeWidgets, {
    props: {
      nodeData,
      node
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

describe('NodeWidgets', () => {
  describe('node-type prop passing', () => {
    it('passes node type to widget components', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('CheckpointLoaderSimple')
      const node = createMockNode([widget], nodeData.id, nodeData.type)
      const { container } = renderComponent({ nodeData, node })

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe(
        'CheckpointLoaderSimple'
      )
    })

    it('renders no widgets when nodeData is undefined', () => {
      const { container } = renderComponent({
        node: createMockNode([createMockWidget()])
      })

      expect(container.querySelectorAll('.widget-stub')).toHaveLength(0)
    })

    it('renders no widgets when node is undefined', () => {
      const { container } = renderComponent({
        nodeData: createMockNodeData('CheckpointLoaderSimple')
      })

      expect(container.querySelectorAll('.widget-stub')).toHaveLength(0)
    })

    it('passes empty string when nodeData.type is empty', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('')
      const node = createMockNode([widget], nodeData.id, nodeData.type)
      const { container } = renderComponent({ nodeData, node })

      const stub = container.querySelector('.widget-stub')
      expect(stub).not.toBeNull()
      expect(stub!.getAttribute('data-node-type')).toBe('')
    })
  })

  it('deduplicates widgets with identical render identity while keeping distinct widget ids', () => {
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
    const node = createMockNode(
      [
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: duplicateEntityId
        }),
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: duplicateEntityId
        }),
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: distinctEntityId
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({ nodeData, node })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('prefers a visible duplicate over a hidden duplicate when identities collide', () => {
    const sharedEntityId = widgetId(
      GRAPH_ID,
      toNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const nodeData = createMockNodeData('SubgraphNode')
    const node = createMockNode(
      [
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: sharedEntityId,
          options: { hidden: true }
        }),
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: sharedEntityId,
          options: { hidden: false }
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({ nodeData, node })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(1)
  })

  it('does not deduplicate entries that share names but have different widget types', () => {
    const sharedEntityId = widgetId(
      GRAPH_ID,
      toNodeId('5e0670b8-ea2c-4fb6-8b73-a1100a2d4f8f:19'),
      'string_a'
    )
    const nodeData = createMockNodeData('SubgraphNode')
    const node = createMockNode(
      [
        createMockWidget({
          name: 'string_a',
          type: 'text',
          widgetId: sharedEntityId
        }),
        createMockWidget({
          name: 'string_a',
          type: 'combo',
          widgetId: sharedEntityId
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({ nodeData, node })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('keeps same-name promoted entries distinct by canonical widget identity', () => {
    const firstPromoted = widgetId(
      GRAPH_ID,
      toNodeId('outer-subgraph:1'),
      'text'
    )
    const secondPromoted = widgetId(
      GRAPH_ID,
      toNodeId('outer-subgraph:2'),
      'text'
    )
    const nodeData = createMockNodeData('SubgraphNode')
    const node = createMockNode(
      [
        createMockWidget({
          name: 'text',
          type: 'text',
          widgetId: firstPromoted
        }),
        createMockWidget({
          name: 'text',
          type: 'text',
          widgetId: secondPromoted
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({ nodeData, node })

    expect(container.querySelectorAll('.lg-node-widget')).toHaveLength(2)
  })

  it('hides widgets when merged store options mark them hidden', async () => {
    const nodeData = createMockNodeData('TestNode', toNodeId('test_node'))
    const node = createMockNode(
      [
        createMockWidget({
          name: 'test_widget',
          options: { hidden: false }
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({ nodeData, node })
    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.registerWidget(
      widgetId(GRAPH_ID, toNodeId('test_node'), 'test_widget'),
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
    const seedAEntityId = widgetId(GRAPH_ID, toNodeId('test_node'), 'seed_a')
    const seedBEntityId = widgetId(GRAPH_ID, toNodeId('test_node'), 'seed_b')
    const nodeData = createMockNodeData('TestNode', toNodeId('test_node'))
    const node = createMockNode(
      [
        createMockWidget({
          name: 'seed_a',
          type: 'text',
          widgetId: seedAEntityId
        }),
        createMockWidget({
          name: 'seed_b',
          type: 'text',
          widgetId: seedBEntityId
        })
      ],
      nodeData.id,
      nodeData.type
    )

    const { container } = render(NodeWidgets, {
      props: { nodeData, node },
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

  it('uses render-state source execution metadata for widget errors', () => {
    const id = widgetId(GRAPH_ID, toNodeId('test_node'), 'seed')
    const sourceExecutionId = createNodeExecutionId([
      toNodeId(65),
      toNodeId(18)
    ])
    const nodeData = createMockNodeData('SubgraphNode', toNodeId('test_node'))
    const node = createMockNode(
      [createMockWidget({ name: 'seed', type: 'text', widgetId: id })],
      nodeData.id,
      nodeData.type
    )

    const { container } = renderComponent({
      nodeData,
      node,
      setupStores: () => {
        useExecutionErrorStore().lastNodeErrors = {
          [sourceExecutionId]: {
            errors: [
              {
                type: 'value_not_in_list',
                message: 'seed is invalid',
                details: '',
                extra_info: { input_name: 'seed' }
              }
            ],
            class_type: 'InnerNode',
            dependent_outputs: []
          }
        }
        useWidgetValueStore().registerWidget(id, {
          type: 'text',
          value: 'value',
          options: {}
        })
        useWidgetValueStore().registerWidgetRenderState(id, {
          sourceExecutionId,
          sourceWidgetName: 'internal_seed'
        })
      }
    })

    expect(container.querySelector('.widget-stub')?.className).toContain(
      'text-node-stroke-error'
    )
  })
})
