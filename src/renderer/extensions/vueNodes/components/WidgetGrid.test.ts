import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { defineComponent, markRaw } from 'vue'
import { assert, describe, expect, it, vi } from 'vitest'
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
  globalThis.ResizeObserver = TestResizeObserver
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
  it.for([true, false])(
    'tracks row geometry only when syncLayout is %s',
    async (syncLayout) => {
      const graphId = 'widget-grid-graph'
      const nodeId = toNodeId(1)
      useCanvasStore().canvas = fromPartial({
        canvas: document.createElement('canvas'),
        setDirty: vi.fn()
      })
      Object.assign(useCanvasStore(), {
        rootGraphId: graphId,
        linearMode: false
      })
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
      const grid = screen.getByTestId('node-widgets')
      grid.getBoundingClientRect = () => new DOMRect(0, 30, 200, 270)
      const row = screen.getByTestId('node-widget')
      const socket = screen.getByTestId('slot-dot')
      socket.getBoundingClientRect = () => new DOMRect(0, 140, 8, 8)
      for (const observer of observers) observer.resize(grid)
      expect(
        layoutStore.getSlotOffset(graphId, nodeId, 0, 'input', 'expanded')
      ).toEqual(syncLayout ? { x: 0, y: 114 } : null)

      // Internal rows redistribute space without changing the node or grid bounds.
      socket.getBoundingClientRect = () => new DOMRect(0, 100, 8, 8)
      for (const observer of observers) observer.resize(row)
      expect(
        layoutStore.getSlotOffset(graphId, nodeId, 0, 'input', 'expanded')
      ).toEqual(syncLayout ? { x: 0, y: 74 } : null)

      await rerender({ processedWidgets: [widget('steps', 'number', 1)] })
      expect(observers.every((observer) => !observer.elements.has(row))).toBe(
        true
      )
      const replacement = screen.getByTestId('node-widget')
      expect(
        observers.some((observer) => observer.elements.has(replacement))
      ).toBe(syncLayout)
      unmount()
      expect(observers.every((observer) => !observer.elements.has(grid))).toBe(
        true
      )
      expect(
        observers.every((observer) => !observer.elements.has(replacement))
      ).toBe(true)
    }
  )

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
