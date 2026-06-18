import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { asNodeId } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import WidgetItem from './WidgetItem.vue'

const { mockGetInputSpecForWidget, StubWidgetComponent } = vi.hoisted(() => ({
  mockGetInputSpecForWidget: vi.fn(),
  StubWidgetComponent: {
    name: 'StubWidget',
    props: ['widget', 'modelValue', 'nodeId', 'nodeType'],
    template:
      '<div class="stub-widget" :data-widget-options="JSON.stringify(widget?.options)" :data-widget-type="widget?.type" :data-widget-name="widget?.name" :data-widget-value="String(widget?.value)" />'
  }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    getInputSpecForWidget: mockGetInputSpecForWidget
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty: vi.fn() }
  })
}))

vi.mock('@/stores/workspace/favoritedWidgetsStore', () => ({
  useFavoritedWidgetsStore: () => ({
    isFavorited: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn()
  })
}))

vi.mock('@/composables/graph/useGraphNodeManager', () => ({
  getControlWidget: vi.fn(() => undefined)
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry',
  () => ({
    getComponent: () => StubWidgetComponent,
    shouldExpand: () => false
  })
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue',
  () => ({
    default: StubWidgetComponent
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        fallbackNodeTitle: 'Untitled'
      }
    }
  }
})

function createMockNode(overrides: Partial<LGraphNode> = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 1,
    type: 'TestNode',
    isSubgraphNode: () => false,
    graph: { rootGraph: { id: 'test-graph-id' } },
    ...overrides
  })
}

function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    name: 'test_widget',
    type: 'combo',
    value: 'option_a',
    y: 0,
    options: {
      values: ['option_a', 'option_b', 'option_c']
    },
    ...overrides
  } as IBaseWidget
}

function renderWidgetItem(
  widget: IBaseWidget,
  node: LGraphNode = createMockNode()
) {
  return render(WidgetItem, {
    props: { widget, node },
    global: {
      plugins: [i18n],
      stubs: {
        EditableText: { template: '<span />' },
        WidgetActions: { template: '<span />' }
      }
    }
  })
}

function getStubWidget(container: Element) {
  // eslint-disable-next-line testing-library/no-node-access
  const el = container.querySelector('.stub-widget')
  if (!el) throw new Error('stub-widget not found')
  return {
    options: JSON.parse(el.getAttribute('data-widget-options') ?? 'null'),
    type: el.getAttribute('data-widget-type'),
    name: el.getAttribute('data-widget-name'),
    value: el.getAttribute('data-widget-value')
  }
}

describe('WidgetItem', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  describe('widget state rendering', () => {
    it('passes options from a regular widget to the widget component', () => {
      const widget = createMockWidget({
        options: { values: ['a', 'b', 'c'] }
      })
      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.options).toEqual({
        values: ['a', 'b', 'c']
      })
    })

    it('passes options from widget state to the widget component', () => {
      const expectedOptions = {
        values: ['model_a.safetensors', 'model_b.safetensors']
      }
      const id = widgetId('test-graph-id', asNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, name: 'ckpt_name' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: expectedOptions
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.options).toEqual(expectedOptions)
    })

    it('passes type from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', asNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, type: 'string' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.type).toBe('combo')
    })

    it('passes name from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', asNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, name: 'source_name' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.name).toBe('ckpt_name')
    })

    it('passes value from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', asNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, value: 'source value' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.value).toBe('model_a.safetensors')
    })
  })
})
