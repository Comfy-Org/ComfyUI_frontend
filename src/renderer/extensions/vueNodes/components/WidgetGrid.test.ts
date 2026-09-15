import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { defineComponent, markRaw } from 'vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { toNodeId } from '@/types/nodeId'

const observers = vi.hoisted(() => {
  const observers: TestResizeObserver[] = []
  class TestResizeObserver implements ResizeObserver {
    elements = new Set<Element>()
    constructor(readonly callback: ResizeObserverCallback) {
      observers.push(this)
    }
    observe(element: Element) {
      this.elements.add(element)
    }
    unobserve(element: Element) {
      this.elements.delete(element)
    }
    disconnect() {
      this.elements.clear()
    }
    resize(element: Element) {
      if (this.elements.has(element)) {
        this.callback(
          [fromPartial<ResizeObserverEntry>({ target: element })],
          this
        )
      }
    }
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  return observers
})

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'),
  () => ({
    useSlotLinkInteraction: () => ({
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onPointerDown: vi.fn()
    })
  })
)

const WidgetStub = markRaw(
  defineComponent({
    props: { invalid: Boolean },
    template:
      '<div data-testid="widget-wrapper"><input data-testid="widget-control" :aria-invalid="invalid || undefined" /></div>'
  })
)

const InputSlotStub = defineComponent({
  props: {
    index: { type: Number, required: true },
    slotData: { type: Object, required: true },
    standalone: { type: Boolean, default: false }
  },
  template:
    '<div data-testid="input-slot" :data-index="index" :data-name="slotData.name" :data-standalone="standalone" />'
})

const AppInputStub = defineComponent({
  props: {
    name: { type: String, required: true }
  },
  template:
    '<div data-testid="app-input" :data-widget-name="name"><slot /></div>'
})

function widget(name: string, type: string, index: number): WidgetGridItem {
  return {
    renderKey: name,
    simplified: { name, type, value: 0 },
    slotMetadata: {
      index,
      linked: false,
      promoted: false,
      type: 'FLOAT'
    },
    visible: true,
    vueComponent: WidgetStub
  }
}

describe('WidgetGrid', () => {
  beforeEach(() => {
    // The composable constructs its ResizeObserver at module load, so the stub
    // is hoisted; the registry it fills is reset here so tests stay isolated.
    for (const observer of observers) observer.disconnect()
  })

  it.for([true, false])(
    'tracks row geometry only when syncLayout is %s',
    async (syncLayout) => {
      const graphId = 'widget-grid-graph'
      const nodeId = toNodeId(1)
      useCanvasStore().canvas = fromPartial({
        canvas: document.createElement('canvas'),
        graph: fromPartial({ rootGraph: { id: graphId } }),
        setDirty: vi.fn()
      })
      useCanvasStore().linearMode = false
      layoutStore.resetForTests()
      const { container, rerender, unmount } = render(WidgetGrid, {
        props: {
          nodeId,
          nodeType: 'TestNode',
          syncLayout,
          processedWidgets: [widget('width', 'number', 0)]
        },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: { g: { inputTooltip: 'Input: {name}' } } }
            })
          ],
          directives: { tooltip: {} },
          stubs: { AppInput: AppInputStub }
        }
      })
      assert.instanceOf(container, HTMLElement)
      container.dataset.nodeId = String(nodeId)
      Object.defineProperty(container, 'offsetWidth', { value: 200 })
      container.getBoundingClientRect = () => new DOMRect(0, 0, 200, 300)
      const stored = () =>
        layoutStore.getSlotOffset(graphId, nodeId, 0, 'input', 'expanded')
      const expected = (y: number) => (syncLayout ? { x: 0, y } : null)
      const resizeAll = (...elements: Element[]) => {
        for (const observer of observers)
          for (const element of elements) observer.resize(element)
      }
      const grid = screen.getByTestId('node-widgets')
      grid.getBoundingClientRect = () => new DOMRect(0, 30, 200, 270)
      const row = screen.getByTestId('node-widget')
      const socket = screen.getByTestId('slot-dot')
      socket.getBoundingClientRect = () => new DOMRect(0, 140, 8, 8)
      resizeAll(grid)
      expect(stored()).toEqual(expected(114))

      // Internal rows redistribute space without changing the node or grid bounds.
      socket.getBoundingClientRect = () => new DOMRect(0, 100, 8, 8)
      resizeAll(row)
      expect(stored()).toEqual(expected(74))

      await rerender({ processedWidgets: [widget('steps', 'number', 0)] })
      const replacement = screen.getByTestId('node-widget')
      const replacementSocket = screen.getByTestId('slot-dot')
      // The replacement row keeps the store current, and a late resize on the
      // replaced row must not write its detached geometry over it.
      replacementSocket.getBoundingClientRect = () => new DOMRect(0, 120, 8, 8)
      resizeAll(replacement)
      expect(stored()).toEqual(expected(94))
      socket.getBoundingClientRect = () => new DOMRect(0, 60, 8, 8)
      resizeAll(row)
      expect(stored()).toEqual(expected(94))

      unmount()
      // Nothing survives unmount: a resize on the old grid or row cannot
      // write a stale offset for the node.
      replacementSocket.getBoundingClientRect = () => new DOMRect(0, 200, 8, 8)
      resizeAll(grid, replacement)
      expect(stored()).toEqual(expected(94))
    }
  )

  it('keeps tracking rows after they are reordered', async () => {
    const graphId = 'widget-grid-graph'
    const nodeId = toNodeId(2)
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      graph: fromPartial({ rootGraph: { id: graphId } }),
      setDirty: vi.fn()
    })
    useCanvasStore().linearMode = false
    layoutStore.resetForTests()
    const widgets = [
      widget('width', 'number', 0),
      widget('height', 'number', 1)
    ]
    const { container, rerender } = render(WidgetGrid, {
      props: {
        nodeId,
        nodeType: 'TestNode',
        syncLayout: true,
        processedWidgets: widgets
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { g: { inputTooltip: 'Input: {name}' } } }
          })
        ],
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub }
      }
    })
    assert.instanceOf(container, HTMLElement)
    container.dataset.nodeId = String(nodeId)
    Object.defineProperty(container, 'offsetWidth', { value: 200 })
    container.getBoundingClientRect = () => new DOMRect(0, 0, 200, 300)
    const offsetOf = (index: number) =>
      layoutStore.getSlotOffset(graphId, nodeId, index, 'input', 'expanded')
    const placeSockets = (tops: number[]) => {
      screen.getAllByTestId('slot-dot').forEach((socket, i) => {
        socket.getBoundingClientRect = () => new DOMRect(0, tops[i], 8, 8)
      })
    }

    placeSockets([100, 140])
    for (const row of screen.getAllByTestId('node-widget')) {
      for (const observer of observers) observer.resize(row)
    }
    expect(offsetOf(0)).toEqual({ x: 0, y: 74 })
    expect(offsetOf(1)).toEqual({ x: 0, y: 114 })

    await rerender({ processedWidgets: [widgets[1], widgets[0]] })
    // Same rows, swapped order: height now sits above width in the DOM.
    placeSockets([100, 140])
    for (const row of screen.getAllByTestId('node-widget')) {
      for (const observer of observers) observer.resize(row)
    }
    expect(offsetOf(1)).toEqual({ x: 0, y: 74 })
    expect(offsetOf(0)).toEqual({ x: 0, y: 114 })
  })

  it('shows socket-only labels and restores controls when disconnected', async () => {
    const connectedWidgets = ['width', 'height', 'prompt'].map(
      (name, index) => ({
        ...widget(name, name === 'prompt' ? 'text' : 'number', index),
        slotMetadata: {
          index,
          linked: true,
          promoted: false,
          type: name === 'prompt' ? 'STRING' : 'INT'
        },
        visible: false,
        suppressedByConnection: true
      })
    )
    const otherWidgets = [
      { ...widget('seed', 'converted-widget', 3), visible: false },
      {
        ...widget('hidden_by_extension', 'number', 4),
        visible: false
      },
      {
        ...widget('hidden_no_slot', 'text', 5),
        visible: false,
        suppressedByConnection: true,
        slotMetadata: undefined
      },
      widget('steps', 'number', 6)
    ]
    const { rerender } = render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        syncLayout: false,
        processedWidgets: [...connectedWidgets, ...otherWidgets]
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { g: { inputTooltip: 'Input: {name}' } } }
          })
        ],
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub }
      }
    })

    for (const name of ['width', 'height', 'prompt', 'seed']) {
      expect(screen.getByText(name)).toBeVisible()
    }
    expect(screen.queryByText('steps')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden_by_extension')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden_no_slot')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('slot-connection-dot')).toHaveLength(5)
    expect(screen.getAllByTestId('widget-control')).toHaveLength(1)

    await rerender({
      processedWidgets: [
        ...connectedWidgets.map((item) => ({
          ...item,
          slotMetadata: { ...item.slotMetadata, linked: false },
          visible: true,
          suppressedByConnection: false
        })),
        ...otherWidgets
      ]
    })

    for (const name of ['width', 'height', 'prompt', 'steps']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
    expect(screen.getByText('seed')).toBeVisible()
    expect(screen.getAllByTestId('slot-connection-dot')).toHaveLength(5)
    expect(screen.getAllByTestId('widget-control')).toHaveLength(4)
  })

  it('renders hidden converted widgets as input sockets without controls', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [
          { ...widget('seed', 'converted-widget', 0), visible: false },
          {
            ...widget('control_after_generate', 'converted-widget:seed', 1),
            slotMetadata: undefined
          },
          widget('replacement', 'number', 2),
          widget('converted-widget-picker', 'converted-widget-picker', 3),
          { ...widget('hidden', 'number', 4), visible: false }
        ]
      },
      global: {
        directives: { tooltip: {} },
        stubs: {
          AppInput: AppInputStub,
          InputSlot: InputSlotStub
        }
      }
    })

    expect(
      screen.getAllByTestId('input-slot').map((element) => element.dataset.name)
    ).toEqual(['seed', 'replacement', 'converted-widget-picker'])
    expect(
      screen
        .getAllByTestId('input-slot')
        .map((element) => element.dataset.standalone)
    ).toEqual(['false', 'false', 'false'])
    expect(screen.getAllByTestId('node-widget')).toHaveLength(2)
    expect(
      screen
        .getAllByTestId('app-input')
        .map((element) => element.dataset.widgetName)
    ).toEqual(['replacement', 'converted-widget-picker'])
    expect(screen.getAllByTestId('widget-control')).toHaveLength(2)
  })

  it('passes execution errors to the widget control API', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [{ ...widget('seed', 'string', 0), hasError: true }]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('widget-control')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByTestId('widget-wrapper')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByTestId('app-input')).not.toHaveAttribute('aria-invalid')
  })

  it('renders connection-suppressed widgets as input sockets without controls', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [
          {
            ...widget('prompt', 'text', 0),
            visible: false,
            suppressedByConnection: true
          },
          {
            ...widget('hidden_no_slot', 'text', 1),
            visible: false,
            suppressedByConnection: true,
            slotMetadata: undefined
          },
          {
            ...widget('hidden_by_extension', 'text', 2),
            visible: false
          },
          widget('steps', 'number', 3)
        ]
      },
      global: {
        directives: { tooltip: {} },
        stubs: {
          AppInput: AppInputStub,
          InputSlot: InputSlotStub
        }
      }
    })

    expect(
      screen.getAllByTestId('input-slot').map((element) => element.dataset.name)
    ).toEqual(['prompt', 'steps'])
    expect(
      screen
        .getAllByTestId('input-slot')
        .map((element) => element.dataset.standalone)
    ).toEqual(['true', 'false'])
    expect(screen.getAllByTestId('node-widget')).toHaveLength(1)
    expect(
      screen
        .getAllByTestId('app-input')
        .map((element) => element.dataset.widgetName)
    ).toEqual(['steps'])
  })
})
