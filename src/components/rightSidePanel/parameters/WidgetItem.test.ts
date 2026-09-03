import { fromAny } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type * as WidgetRegistry from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import WidgetItem from './WidgetItem.vue'

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

vi.mock('primevue/inputtext', () => ({
  default: {
    props: ['disabled', 'modelValue', 'readonly'],
    emits: ['update:modelValue'],
    template:
      '<input :disabled :readonly :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
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
    graph: { id: 'test-graph-id', rootGraph: { id: 'test-graph-id' } },
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
  }
}

function renderWidgetItem(
  widget: IBaseWidget,
  node: LGraphNode = createMockNode()
) {
  if (node.graph) {
    const scope = graphScopeOf(node.graph)
    node.inputs?.forEach((input, targetSlot) => {
      if (input.link == null) return
      useLinkStore().registerLink(scope, {
        id: input.link,
        graphId: scope.owningGraphId,
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: node.id,
        targetSlot,
        type: String(input.type)
      })
    })
  }

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
      Object.defineProperty(widget, 'type', {
        get: () => useWidgetValueStore().getWidget(id)?.type ?? 'string'
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

    it('restores a linked text control in Parameters after disconnect', async () => {
      const widget = createMockWidget({
        name: 'prompt',
        type: 'text',
        value: 'STALE PARAMETER TEXT'
      })
      const promptInput = {
        name: 'prompt',
        type: 'STRING',
        link: toLinkId(1),
        boundingRect: [0, 0, 0, 0],
        widget: { name: 'prompt' }
      }
      const node = createMockNode({
        inputs: [promptInput]
      })

      const view = renderWidgetItem(widget, node)

      const content = screen.getByTestId('linked-widget-content')
      const input = screen.getByRole('textbox', { hidden: true })
      expect(content).toHaveAttribute('inert')
      expect(content).toHaveAttribute('aria-hidden', 'true')
      expect(input).toBeDisabled()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(
        screen.getByRole('img', { name: 'prompt: Linked input' })
      ).toBeVisible()

      const scope = graphScopeOf(node.graph!)
      const link = useLinkStore().getInputSlotLink(scope, node.id, 0)
      expect(link).toBeDefined()
      expect(useLinkStore().deleteLink(scope, link!)).toBe(true)
      await view.rerender({
        widget,
        node: createMockNode({
          inputs: [{ ...promptInput, link: null }]
        })
      })

      expect(screen.queryByRole('img')).toBeNull()
      const restoredInput = screen.getByRole('textbox', { name: 'prompt' })
      expect(restoredInput).toBeVisible()
      expect(restoredInput).toBeEnabled()
      expect(restoredInput).toHaveValue('STALE PARAMETER TEXT')

      const user = userEvent.setup()
      await user.clear(restoredInput)
      await user.type(restoredInput, 'restored parameter text')

      expect(view.emitted()['update:widgetValue']).toContainEqual([
        'restored parameter text'
      ])
    })

    it('uses the bounded linked resolver for ordinary combos', () => {
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
      const { container } = renderWidgetItem(widget, node)

      expect(getStubWidget(container).linkedDisplay).toBe('control')
    })

    it('keeps upload combos on the disabled fallback', () => {
      mockGetInputSpecForWidget.mockReturnValue({
        type: 'COMBO',
        name: 'option',
        image_upload: true
      })
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
      const { container } = renderWidgetItem(widget, node)

      expect(getStubWidget(container).linkedDisplay).toBeNull()
      expect(getStubWidget(container).options.disabled).toBe(true)
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
      const id = widgetId('test-graph-id', toNodeId(1), 'gradient')
      const widget = createMockWidget({
        widgetId: id,
        name: 'gradient',
        type: 'gradientslider'
      })
      useWidgetValueStore().registerWidget(id, {
        type: 'number',
        value: 0.5,
        options: {}
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
      expect(stub.type).toBe('gradientslider')
      expect(stub.options.disabled).toBe(true)
      expect(screen.queryByTestId('linked-widget-placeholder')).toBeNull()
    })

    it('passes null from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, value: 'source value' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: null,
        options: {}
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.value).toBe('null')
    })

    it('updates disabled options when the widget input is linked', async () => {
      const inputs: INodeInputSlot[] = [
        {
          name: 'seed',
          type: 'INT',
          link: null,
          boundingRect: [0, 0, 0, 0],
          widget: { name: 'seed' }
        }
      ]
      const node = createMockNode(
        fromAny<Partial<LGraphNode>, unknown>({ inputs })
      )
      const widget = createMockWidget({ name: 'seed', options: {} })

      const { container } = renderWidgetItem(widget, node)
      expect(getStubWidget(container).options.disabled).toBeUndefined()

      const graphScope = graphScopeOf(node.graph!)
      useLinkStore().registerLink(graphScope, {
        id: toLinkId(1),
        graphId: graphScope.owningGraphId,
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: node.id,
        targetSlot: 0,
        type: 'INT'
      })
      await nextTick()

      expect(getStubWidget(container).options.disabled).toBe(true)
    })
  })
})
