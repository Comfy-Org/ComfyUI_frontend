import { render, screen } from '@testing-library/vue'
import { defineComponent, markRaw } from 'vue'
import { describe, expect, it } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { toNodeId } from '@/types/nodeId'

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
})
