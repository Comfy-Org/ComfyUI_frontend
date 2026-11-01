import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type {
  SafeControlWidget,
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetWithControl from './WidgetWithControl.vue'
import { createMockWidget } from './widgetTestUtils'

const ValueControlButtonStub = defineComponent({
  name: 'ValueControlButton',
  props: { mode: { type: String, default: '' } },
  template:
    '<button data-testid="control-button" :data-mode="mode">{{ mode }}</button>'
})

const ValueControlPopoverStub = defineComponent({
  name: 'ValueControlPopover',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `
    <div data-testid="control-popover">
      <button
        data-testid="set-fixed"
        @click="$emit('update:modelValue', 'fixed')"
      >fixed</button>
    </div>
  `
})

const RenderedComponent = defineComponent({
  name: 'RenderedComponent',
  props: {
    widget: { type: Object, default: () => ({}) },
    modelValue: { type: Number, default: 0 }
  },
  template: `
    <div data-testid="rendered"
         :data-widget-name="widget?.name"
         :data-model-value="String(modelValue)">
      <slot />
    </div>
  `
})

const makeControlWidget = (
  update: (value: WidgetValue) => void = () => {},
  initial = 'randomize'
): SimplifiedControlWidget => {
  const controlWidget: SafeControlWidget = {
    value: initial as SafeControlWidget['value'],
    update: (value) => update(value)
  }
  return createMockWidget<WidgetValue>({
    value: 0,
    name: 'wrapped_widget',
    type: 'int',
    options: {},
    controlWidget
  }) as SimplifiedControlWidget
}

const mount = (widget: SimplifiedControlWidget, modelValue = 0) =>
  render(WidgetWithControl, {
    global: {
      stubs: {
        ValueControlButton: ValueControlButtonStub,
        ValueControlPopover: ValueControlPopoverStub
      }
    },
    props: { widget, modelValue, component: RenderedComponent }
  })

describe('WidgetWithControl', () => {
  it.for([
    { name: 'select', component: WidgetSelectDefault },
    { name: 'slider', component: WidgetInputNumberSlider },
    { name: 'gradient slider', component: WidgetInputNumberGradientSlider }
  ])(
    'changes the generation mode for a unified $name',
    async ({ component }) => {
      let mode: WidgetValue = 'randomize'
      const widget: SimplifiedControlWidget<number> = {
        name: 'controlled_widget',
        type: 'number',
        value: 1,
        options: { values: [1, 2], min: 0, max: 10 },
        controlWidget: {
          value: 'randomize',
          update: (value) => {
            mode = value
          }
        }
      }
      render(WidgetWithControl, {
        props: { widget, component, modelValue: 1 },
        global: {
          plugins: [
            createI18n({ legacy: false, locale: 'en', messages: { en } })
          ],
          provide: { [UnifiedWidgetRowsKey]: true }
        }
      })
      const user = userEvent.setup()

      await user.click(screen.getByTestId('value-control'))
      await user.click(await screen.findByRole('radio', { name: /fixed/i }))

      expect(mode).toBe('fixed')
    }
  )

  it('renders the passed component with widget and modelValue', () => {
    mount(makeControlWidget(), 42)
    const rendered = screen.getByTestId('rendered')
    expect(rendered).toHaveAttribute('data-widget-name', 'wrapped_widget')
    expect(rendered).toHaveAttribute('data-model-value', '42')
  })

  it('initializes ValueControlButton mode from widget.controlWidget.value', () => {
    mount(makeControlWidget(() => {}, 'increment'))
    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'increment'
    )
  })

  it('calls widget.controlWidget.update when popover emits a new mode', async () => {
    const update = vi.fn<(value: WidgetValue) => void>()
    mount(makeControlWidget(update, 'randomize'))

    const user = userEvent.setup()
    await user.click(screen.getByTestId('control-button'))
    await user.click(screen.getByTestId('set-fixed'))
    await nextTick()

    expect(update).toHaveBeenCalledWith('fixed')
  })

  it('does not call update on initial mount', () => {
    const update = vi.fn()
    mount(makeControlWidget(update, 'randomize'))
    expect(update).not.toHaveBeenCalled()
  })
})
