import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  SafeControlWidget,
  SimplifiedControlWidget,
  WidgetValue
} from '@/types/simplifiedWidget'

import WidgetWithControl from './WidgetWithControl.vue'
import ValueControlPopover from './ValueControlPopover.vue'
import { createMockWidget } from './widgetTestUtils'

vi.mock('primevue/radiobutton', () => ({
  default: {
    props: ['inputId', 'modelValue', 'value'],
    emits: ['update:modelValue'],
    template:
      '<input :id="inputId" type="radio" :value :checked="modelValue === value" @change="$emit(\'update:modelValue\', value)" />'
  }
}))

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
  props: {
    disabled: { type: Boolean, default: false },
    mode: { type: String, default: '' }
  },
  template:
    '<button data-testid="control-button" :data-mode="mode" :disabled>{{ mode }}</button>'
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

const PortaledPopoverStub = defineComponent({
  name: 'Popover',
  components: { ValueControlPopover },
  setup() {
    const open = ref(false)
    return { open }
  },
  template: `
    <span @click.capture="open = true">
      <slot name="button" />
    </span>
    <Teleport v-if="open" to="body">
      <ValueControlPopover model-value="randomize" />
    </Teleport>
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
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
        Popover: PopoverStub,
        ValueControlButton: ValueControlButtonStub,
        ValueControlPopover: ValueControlPopoverStub
      }
    },
    props: { widget, modelValue, component: RenderedComponent }
  })

const mountWithPortal = (widget: SimplifiedControlWidget, modelValue = 0) =>
  render(WidgetWithControl, {
    global: {
      plugins: [createTestingPinia(), i18n],
      stubs: { Popover: PortaledPopoverStub }
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

  it('calls widget.controlWidget.update when popover emits a new mode', async () => {
    const update = vi.fn<(value: WidgetValue) => void>()
    mount(makeControlWidget(update, 'randomize'))

    const user = userEvent.setup()
    await user.click(screen.getByTestId('set-fixed'))
    await nextTick()

    expect(update).toHaveBeenCalledWith('fixed')
  })

  it('does not call update on initial mount', () => {
    const update = vi.fn()
    mount(makeControlWidget(update, 'randomize'))
    expect(update).not.toHaveBeenCalled()
  })

  it('disables the value control with the wrapped widget', () => {
    const widget = makeControlWidget()
    widget.options = { disabled: true }
    mount(widget)

    expect(screen.getByTestId('control-button')).toBeDisabled()
  })

  it('unmounts an open value-control portal when linked', async () => {
    const update = vi.fn<(value: WidgetValue) => void>()
    const widget = makeControlWidget(update, 'randomize')
    const { rerender } = mountWithPortal(widget)
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('value-control'))
    expect(await screen.findAllByRole('radio')).toHaveLength(4)

    const linkedWidget: SimplifiedControlWidget = {
      ...widget,
      linkedDisplay: 'control',
      options: { ...widget.options, disabled: true }
    }
    update.mockClear()
    await rerender({
      widget: linkedWidget,
      modelValue: 0,
      component: RenderedComponent
    })

    await waitFor(() => expect(screen.queryAllByRole('radio')).toHaveLength(0))
    const linkedButton = screen.getByTestId('value-control')
    expect(linkedButton).toBeDisabled()
    linkedButton.focus()
    expect(linkedButton).not.toHaveFocus()
    await user.click(linkedButton)
    await user.keyboard('{Enter}')
    expect(update).not.toHaveBeenCalled()
  })

  it('unmounts an open value-control portal when disabled', async () => {
    const widget = makeControlWidget()
    const { rerender } = mountWithPortal(widget)
    const user = userEvent.setup()

    await user.click(await screen.findByTestId('value-control'))
    expect(await screen.findAllByRole('radio')).toHaveLength(4)

    await rerender({
      widget: {
        ...widget,
        options: { ...widget.options, disabled: true }
      },
      modelValue: 0,
      component: RenderedComponent
    })

    await waitFor(() => expect(screen.queryAllByRole('radio')).toHaveLength(0))
    expect(screen.getByTestId('value-control')).toBeDisabled()
  })
})
