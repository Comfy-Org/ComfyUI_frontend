import { render, screen } from '@testing-library/vue'
import { defineComponent, markRaw } from 'vue'
import { describe, expect, it } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

const WidgetStub = markRaw(
  defineComponent({
    template: '<div data-testid="widget-control" />'
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
    name: { type: String, default: undefined }
  },
  template:
    '<div data-testid="app-input" :data-enable="String(enable)" :data-widget-name="name"><slot /></div>'
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
  it('renders converted widgets as input sockets without controls', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [
          widget('seed', 'converted-widget', 0),
          {
            ...widget('control_after_generate', 'converted-widget:seed', 1),
            slotMetadata: undefined
          },
          widget('replacement', 'number', 2),
          widget('converted-widget-picker', 'converted-widget-picker', 3)
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

  it('falls back to the node selection state without a per-widget callback', () => {
    const item: WidgetGridItem = {
      simplified: {
        name: 'seed',
        type: 'number',
        value: 1,
        options: {}
      },
      vueComponent: { template: '<div />' },
      visible: true,
      renderKey: 'seed',
      widgetId: widgetId('graph', toNodeId(1), 'seed')
    }
    render(WidgetGrid, {
      props: {
        processedWidgets: [item],
        nodeType: 'TestNode',
        canSelectInputs: true
      },
      global: {
        stubs: { AppInput: AppInputStub, InputSlot: true },
        directives: { tooltip: () => undefined }
      }
    })

    expect(screen.getByTestId('app-input')).toHaveAttribute(
      'data-enable',
      'true'
    )
  })
})
