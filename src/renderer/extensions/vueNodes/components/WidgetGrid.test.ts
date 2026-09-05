import { fireEvent, render, screen } from '@testing-library/vue'
import { defineComponent, markRaw } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { toNodeId } from '@/types/nodeId'

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
    slotData: { type: Object, required: true }
  },
  template:
    '<div data-testid="input-slot" :data-index="index" :data-name="slotData.name" />'
})

const AppInputStub = defineComponent({
  props: {
    enable: { type: Boolean, default: false },
    name: { type: String, required: true }
  },
  template:
    '<div data-testid="app-input" :data-enabled="enable" :data-widget-name="name"><slot /></div>'
})

function linkedWidget(handleContextMenu = vi.fn()): WidgetGridItem {
  return {
    simplified: {
      name: 'prompt',
      type: 'text',
      value: 'stale local prompt',
      linkedDisplay: 'control'
    },
    vueComponent: WidgetStub,
    visible: true,
    renderKey: 'prompt:text',
    handleContextMenu
  }
}

function renderGrid(widget: WidgetGridItem) {
  return render(WidgetGrid, {
    props: {
      processedWidgets: [widget],
      nodeType: 'TestNode',
      canSelectInputs: true
    },
    global: {
      stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub },
      directives: { tooltip: {} }
    }
  })
}

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
  it('disables input promotion for a linked widget', () => {
    renderGrid(linkedWidget())

    expect(screen.getByTestId('app-input')).toHaveAttribute(
      'data-enabled',
      'false'
    )
  })

  it('dispatches context menu actions around an inert linked widget', async () => {
    const handleContextMenu = vi.fn()
    renderGrid(linkedWidget(handleContextMenu))

    await fireEvent.contextMenu(screen.getByTestId('app-input'))

    expect(handleContextMenu).toHaveBeenCalledOnce()
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
})
