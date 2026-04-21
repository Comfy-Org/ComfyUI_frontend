import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import type {
  SafeControlWidget,
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

import WidgetWithControl from './WidgetWithControl.vue'
import { createMockWidget } from './widgetTestUtils'

const PopoverStub = defineComponent({
  name: 'Popover',
  template: `
    <div data-testid="popover">
      <slot name="button" />
      <slot />
    </div>
  `
})

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
    update
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
        Popover: PopoverStub,
        ValueControlButton: ValueControlButtonStub,
        ValueControlPopover: ValueControlPopoverStub
      }
    },
    props: { widget, modelValue, component: RenderedComponent }
  })

describe('WidgetWithControl', () => {
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

  it('defaults mode to randomize when that is the initial value', () => {
    mount(makeControlWidget(() => {}, 'randomize'))
    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'randomize'
    )
  })

  it('calls widget.controlWidget.update when popover emits a new mode', async () => {
    const update = vi.fn()
    mount(makeControlWidget(update, 'randomize'))

    const user = userEvent.setup()
    await user.click(screen.getByTestId('set-fixed'))
    await nextTick()

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).toBe('fixed')
  })

  it('does not call update on initial mount', () => {
    const update = vi.fn()
    mount(makeControlWidget(update, 'randomize'))
    expect(update).not.toHaveBeenCalled()
  })
})
