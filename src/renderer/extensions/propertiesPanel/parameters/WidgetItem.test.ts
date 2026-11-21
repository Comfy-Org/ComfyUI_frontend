import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial, fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import WidgetItem from './WidgetItem.vue'

beforeEach(() => {
  useCanvasStore().canvas = fromPartial({ setDirty: vi.fn() })
  vi.mocked(app).rootGraph = new LGraph()
})

vi.mock(import('@/scripts/app'))

const { StubWidgetComponent } = await vi.hoisted(async () => {
  const { defineComponent, h } = await import('vue')
  const { useWidgetView } =
    await import('@/renderer/extensions/vueNodes/widgets/useWidgetView')
  return {
    StubWidgetComponent: defineComponent(
      (props: {
        widgetId: WidgetId
        modelValue?: unknown
        nodeId?: unknown
        nodeType?: string
      }) => {
        const widget = useWidgetView(() => props.widgetId)
        return () =>
          h('button', {
            class: 'stub-widget',
            type: 'button',
            'aria-label': widget.value.name,
            'data-widget-options': JSON.stringify(widget.value.options),
            'data-widget-type': widget.value.type,
            'data-widget-name': widget.value.name,
            'data-widget-value': String(widget.value.value)
          })
      },
      {
        name: 'StubWidget',
        props: ['widgetId', 'modelValue', 'nodeId', 'nodeType']
      }
    )
  }
})

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'),

  () => ({
    getComponent: vi.fn(() => StubWidgetComponent),
    shouldExpand: () => false
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'),

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
  // oxlint-disable-next-line testing-library/no-node-access
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
  describe('button actions', () => {
    beforeEach(() => {
      vi.mocked(getComponent).mockReturnValue(WidgetButton)
    })

    function graphNodeWithButton(callback: IBaseWidget['callback']) {
      const graph = new LGraph()
      vi.mocked(app).rootGraph = graph
      const node = new LGraphNode('TestNode')
      graph.add(node)
      const widget = node.addWidget(
        'button',
        'Restore selected',
        undefined,
        () => {}
      )
      widget.callback = callback
      return { node, widget }
    }

    it('invokes the button callback with the original widget and node context', async () => {
      const user = userEvent.setup()
      const callback = vi.fn(function (this: IBaseWidget) {
        this.label = 'Restored'
      })
      const { node, widget } = graphNodeWithButton(callback)
      renderWidgetItem(widget, node)

      await user.click(screen.getByRole('button', { name: widget.name }))

      expect(callback).toHaveBeenCalledExactlyOnceWith(
        undefined,
        vi.mocked(app).canvas,
        node
      )
      expect(widget.label).toBe('Restored')
    })

    it('does not invoke a disabled button callback', async () => {
      const user = userEvent.setup()
      const callback = vi.fn()
      const { node, widget } = graphNodeWithButton(callback)
      widget.disabled = true
      renderWidgetItem(widget, node)

      const button = screen.getByRole('button', { name: widget.name })
      expect(button).toBeDisabled()
      await user.click(button)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('widget state rendering', () => {
    it('passes options from a graph widget to the widget component', () => {
      const graph = new LGraph()
      vi.mocked(app).rootGraph = graph
      const node = new LGraphNode('TestNode')
      graph.add(node)
      const widget = node.addWidget('combo', 'choice', 'a', () => {}, {
        values: ['a', 'b', 'c']
      })

      const { container } = renderWidgetItem(widget, node)

      expect(getStubWidget(container).options).toEqual({
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

    it.for([
      { scenario: 'no type', type: undefined },
      { scenario: 'a non-string type', type: 7 }
    ])('renders a legacy widget with $scenario', ({ type }) => {
      const widget = createMockWidget({})
      Reflect.set(widget, 'type', type)

      const { container } = renderWidgetItem(widget)

      expect(getStubWidget(container).name).toBe('test_widget')
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
      const graph = new LGraph()
      vi.mocked(app).rootGraph = graph
      const source = new LGraphNode('Source')
      source.addOutput('value', 'INT')
      graph.add(source)
      const node = new LGraphNode('Target')
      node.addInput('seed', 'INT', { widget: { name: 'seed' } })
      const widget = node.addWidget('number', 'seed', 1, () => {})
      graph.add(node)

      const { container } = renderWidgetItem(widget, node)
      expect(getStubWidget(container).options.disabled).toBeUndefined()

      source.connect(0, node, 0)
      await nextTick()

      expect(getStubWidget(container).options.disabled).toBe(true)
    })
  })
})
