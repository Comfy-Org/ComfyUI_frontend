import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type * as WidgetRegistry from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'
import { widgetId } from '@/types/widgetId'
import WidgetItem from './WidgetItem.vue'
import { toNodeId } from '@/types/nodeId'

const {
  mockFromLGraphNode,
  mockGetInputSpecForWidget,
  mockIsAssetAPIEnabled,
  mockShouldUseAssetBrowser,
  StubWidgetComponent
} = vi.hoisted(() => ({
  mockFromLGraphNode: vi.fn<() => { isCoreNode: boolean; name: string } | null>(
    () => null
  ),
  mockGetInputSpecForWidget: vi.fn(),
  mockIsAssetAPIEnabled: vi.fn(() => false),
  mockShouldUseAssetBrowser: vi.fn(() => false),
  StubWidgetComponent: {
    name: 'StubWidget',
    props: ['widget', 'modelValue', 'nodeId', 'nodeType'],
    template:
      '<div class="stub-widget" :data-linked-display="widget?.linkedDisplay" :data-widget-options="JSON.stringify(widget?.options)" :data-widget-type="widget?.type" :data-widget-name="widget?.name" :data-widget-value="String(widget?.value)" />'
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    isAssetAPIEnabled: mockIsAssetAPIEnabled,
    shouldUseAssetBrowser: mockShouldUseAssetBrowser
  }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    fromLGraphNode: mockFromLGraphNode,
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
  async (importOriginal) => {
    const original = await importOriginal<typeof WidgetRegistry>()
    const { default: WidgetInputText } =
      await import('@/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue')
    return {
      ...original,
      getComponent: (type: string) =>
        type === 'text' ? WidgetInputText : StubWidgetComponent,
      shouldExpand: () => false
    }
  }
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

function createMockNode(
  overrides: Partial<Record<keyof LGraphNode, unknown>> = {}
): LGraphNode {
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
      plugins: [i18n, PrimeVue],
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
    linkedDisplay: el.getAttribute('data-linked-display'),
    type: el.getAttribute('data-widget-type'),
    name: el.getAttribute('data-widget-name'),
    value: el.getAttribute('data-widget-value')
  }
}

describe('WidgetItem', () => {
  beforeEach(() => {
    mockIsAssetAPIEnabled.mockReturnValue(false)
    mockShouldUseAssetBrowser.mockReturnValue(false)
    mockFromLGraphNode.mockReturnValue(null)
    mockGetInputSpecForWidget.mockReset()
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
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
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
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
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
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
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
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
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

    it('renders a supported linked text status in Parameters', () => {
      const widget = createMockWidget({
        name: 'prompt',
        type: 'text',
        value: 'STALE PARAMETER TEXT'
      })
      const node = createMockNode({
        inputs: [
          {
            name: 'prompt',
            type: 'STRING',
            link: toLinkId(1),
            boundingRect: [0, 0, 0, 0],
            widget: { name: 'prompt' }
          }
        ]
      })

      renderWidgetItem(widget, node)

      const content = screen.getByTestId('linked-widget-content')
      const input = screen.getByRole('textbox', { hidden: true })
      expect(content).toHaveAttribute('inert')
      expect(content).toHaveAttribute('aria-hidden', 'true')
      expect(input).toBeDisabled()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(
        screen.getByRole('img', { name: 'prompt: Linked input' })
      ).toBeVisible()
    })

    it('uses the bounded linked resolver for ordinary and upload combos', () => {
      const widget = createMockWidget({ name: 'option', type: 'COMBO' })
      const node = createMockNode({
        inputs: [
          {
            name: 'option',
            type: 'COMBO',
            link: toLinkId(1),
            boundingRect: [0, 0, 0, 0],
            widget: { name: 'option' }
          }
        ]
      })
      const { container, unmount } = renderWidgetItem(widget, node)

      expect(getStubWidget(container).linkedDisplay).toBe('control')
      unmount()

      mockGetInputSpecForWidget.mockReturnValue({
        type: 'COMBO',
        name: 'option',
        image_upload: true
      })
      const upload = renderWidgetItem(widget, node)

      expect(getStubWidget(upload.container).linkedDisplay).toBeNull()
      expect(getStubWidget(upload.container).options.disabled).toBe(true)
    })

    it.for(['LoadImage', 'LoadImageMask', 'LoadImageOutput'])(
      'uses the linked presentation for the exact core %s selector',
      (nodeType) => {
        mockGetInputSpecForWidget.mockReturnValue({
          type: 'COMBO',
          name: 'image',
          image_upload: true
        })
        mockFromLGraphNode.mockReturnValue({
          name: nodeType,
          isCoreNode: true
        })
        const widget = createMockWidget({ name: 'image', type: 'asset' })
        const node = createMockNode({
          type: nodeType,
          inputs: [
            {
              name: 'image',
              type: 'COMBO',
              link: toLinkId(1),
              boundingRect: [0, 0, 0, 0],
              widget: { name: 'image' }
            }
          ]
        })

        const { container } = renderWidgetItem(widget, node)
        const stub = getStubWidget(container)

        expect(stub.linkedDisplay).toBe('control')
        expect(stub.options.disabled).toBe(true)
      }
    )

    it('does not add linked presentation to a special widget', () => {
      const widget = createMockWidget({
        name: 'gradient',
        type: 'gradientslider'
      })
      const node = createMockNode({
        inputs: [
          {
            name: 'gradient',
            type: 'FLOAT',
            link: toLinkId(1),
            boundingRect: [0, 0, 0, 0],
            widget: { name: 'gradient' }
          }
        ]
      })
      const { container } = renderWidgetItem(widget, node)
      const stub = getStubWidget(container)

      expect(stub.linkedDisplay).toBeNull()
      expect(stub.options.disabled).toBe(true)
      expect(screen.queryByTestId('linked-widget-placeholder')).toBeNull()
    })
  })
})
