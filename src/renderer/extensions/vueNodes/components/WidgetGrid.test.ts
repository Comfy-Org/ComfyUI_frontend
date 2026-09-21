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

function renderGrid(processedWidgets: WidgetGridItem[], syncLayout = true) {
  return render(WidgetGrid, {
    props: {
      nodeId: toNodeId(1),
      nodeType: 'TestNode',
      syncLayout,
      processedWidgets
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
}

function renderLayoutGrid(syncLayout = true) {
  const { container, rerender } = renderGrid(
    [widget('width', 'number', 0)],
    syncLayout
  )
  assert.instanceOf(container, HTMLElement)
  container.dataset.nodeId = '1'
  Object.defineProperty(container, 'offsetWidth', { value: 200 })
  container.getBoundingClientRect = () => new DOMRect(0, 0, 200, 300)
  const grid = screen.getByTestId('node-widgets')
  grid.getBoundingClientRect = () => new DOMRect(0, 30, 200, 270)
  let socketTop = 140
  const socket = screen.getByTestId('slot-dot')
  socket.getBoundingClientRect = () => new DOMRect(0, socketTop, 8, 8)
  const moveSocket = (top: number) => {
    socketTop = top
  }
  const resizeGrid = () => {
    for (const observer of observers) observer.resize(grid)
  }
  const stored = () =>
    layoutStore.getSlotOffset(
      'widget-grid-graph',
      toNodeId(1),
      0,
      'input',
      'expanded'
    )
  return { rerender, stored, moveSocket, resizeGrid }
}

describe('WidgetGrid', () => {
  beforeEach(() => {
    for (const observer of observers) observer.disconnect()
    useCanvasStore().canvas = fromPartial({
      canvas: document.createElement('canvas'),
      graph: fromPartial({ rootGraph: { id: 'widget-grid-graph' } }),
      setDirty: vi.fn()
    })
    useCanvasStore().linearMode = false
    layoutStore.resetForTests()
  })

  it('resyncs slot offsets when a connected row swaps its control for a label', async () => {
    const { rerender, stored, moveSocket, resizeGrid } = renderLayoutGrid()
    resizeGrid()
    expect(stored()).toEqual({ x: 0, y: 114 })

    moveSocket(100)
    await rerender({
      processedWidgets: [
        {
          ...widget('width', 'number', 0),
          visible: false,
          suppressedByConnection: true
        }
      ]
    })

    expect(stored()).toEqual({ x: 0, y: 74 })
  })

  it('does not track layout when syncLayout is disabled', () => {
    const { stored, resizeGrid } = renderLayoutGrid(false)
    resizeGrid()
    expect(stored()).toBeNull()
  })

  it('restores controls when disconnected', async () => {
    const item = widget('prompt', 'text', 0)
    const { rerender } = renderGrid([
      { ...item, visible: false, suppressedByConnection: true }
    ])
    expect(screen.queryByTestId('widget-control')).not.toBeInTheDocument()

    await rerender({ processedWidgets: [item] })

    expect(screen.getByTestId('widget-control')).toBeVisible()
    expect(screen.queryByText('prompt')).not.toBeInTheDocument()
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
    renderGrid([
      {
        ...widget('value_1', 'text', 0),
        simplified: {
          name: 'value_1',
          label: 'duration',
          type: 'text',
          value: 0
        },
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
    ])

    expect(screen.getByText('duration')).toBeVisible()
    expect(screen.getByLabelText('duration')).toBeVisible()
    expect(screen.queryByText('value_1')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden_no_slot')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden_by_extension')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('slot-connection-dot')).toHaveLength(2)
    expect(screen.getAllByTestId('widget-control')).toHaveLength(1)
    expect(screen.getAllByTestId('node-widget')).toHaveLength(1)
    expect(
      screen
        .getAllByTestId('app-input')
        .map((element) => element.dataset.widgetName)
    ).toEqual(['steps'])
  })
})
