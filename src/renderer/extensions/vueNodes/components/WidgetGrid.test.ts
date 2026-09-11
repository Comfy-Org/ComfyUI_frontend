import userEvent from '@testing-library/user-event'
import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
import WidgetDynamicGroupRow from '@/renderer/extensions/vueNodes/widgets/components/WidgetDynamicGroupRow.vue'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import WidgetSelectDefault from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue'
import { render, screen, within } from '@testing-library/vue'
import { computed, defineComponent, h, markRaw, ref } from 'vue'
import { describe, expect, it } from 'vitest'

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
  it.for([0, 1])(
    'identifies repeated fields and restores keyboard focus after deletion with min = %s',
    async (min) => {
      const user = userEvent.setup()
      const rows = ref(['A', 'B', 'C'])
      const items = computed<WidgetGridItem[]>(() => [
        ...rows.value.flatMap((id, index) => [
          {
            renderKey: `${id}-header`,
            visible: true,
            simplified: {
              name: `loras.${index}`,
              type: 'dynamic_group_row',
              value: undefined,
              label: `LoRA #${index + 1}`,
              options: { disabled: rows.value.length <= min },
              callback: () => {
                rows.value = rows.value.filter((row) => row !== id)
              }
            },
            vueComponent: markRaw(WidgetDynamicGroupRow)
          },
          {
            renderKey: `${id}-model`,
            visible: true,
            simplified: {
              name: `loras.${index}.model`,
              type: 'combo',
              value: id,
              label: 'Model',
              options: { values: ['A', 'B', 'C'] }
            },
            vueComponent: markRaw(WidgetSelectDefault)
          }
        ]),
        {
          renderKey: 'add',
          visible: true,
          simplified: {
            name: 'loras.$add',
            type: 'button',
            value: undefined,
            label: 'Add LoRA'
          },
          vueComponent: markRaw(WidgetButton)
        }
      ])
      const Host = defineComponent({
        setup: () => () =>
          h(WidgetGrid, {
            processedWidgets: items.value,
            nodeType: 'TestNode',
            syncLayout: false
          })
      })
      render(Host, {
        global: {
          plugins: [testI18n],
          directives: { tooltip: {} },
          stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
        }
      })

      for (const index of [1, 2, 3]) {
        const group = screen.getByRole('group', { name: `LoRA #${index}` })
        expect(
          within(group).getByRole('combobox', { name: 'Model' })
        ).toBeInTheDocument()
      }
      screen.getByRole('button', { name: 'Remove LoRA #2' }).focus()
      await user.keyboard('{Enter}')
      expect(
        screen.getByRole('button', { name: 'Remove LoRA #2' })
      ).toHaveFocus()
      expect(
        screen.queryByRole('group', { name: 'LoRA #3' })
      ).not.toBeInTheDocument()
      await user.keyboard('{Enter}')
      if (min === 0) {
        expect(
          screen.getByRole('button', { name: 'Remove LoRA #1' })
        ).toHaveFocus()
        await user.keyboard('{Enter}')
      }
      expect(screen.getByRole('button', { name: 'Add LoRA' })).toHaveFocus()
      expect(screen.queryAllByRole('group')).toHaveLength(min)
    }
  )

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
