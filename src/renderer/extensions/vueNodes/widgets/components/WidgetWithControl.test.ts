import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { defineComponent, markRaw, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { app } from '@/scripts/app'
import type { ControlOptions } from '@/core/graph/widgets/controlWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import WidgetSelectDefault from './WidgetSelectDefault.vue'
import WidgetWithControl from './WidgetWithControl.vue'
import { addControlledWidget } from './controlledWidgetFixture'

vi.mock(import('@/scripts/app'))

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
    widgetId: { type: String, required: true },
    modelValue: { type: Number, default: 0 }
  },
  template: `
    <div
      data-testid="rendered"
      :data-widget-id="widgetId"
      :data-model-value="String(modelValue)"
    >
      <slot name="between" />
    </div>
  `
})

const makeControlWidget = (mode: ControlOptions = 'randomize') => {
  const controlled = addControlledWidget({ name: 'wrapped_widget', mode })
  vi.mocked(app).rootGraph = controlled.graph
  return controlled
}

const mount = (widgetId: WidgetId, modelValue = 0) =>
  render(WidgetWithControl, {
    global: {
      stubs: {
        ValueControlButton: ValueControlButtonStub,
        ValueControlPopover: ValueControlPopoverStub
      }
    },
    props: { widgetId, modelValue, component: markRaw(RenderedComponent) }
  })

describe('WidgetWithControl', () => {
  it.for([
    { name: 'select', component: WidgetSelectDefault },
    { name: 'slider', component: WidgetInputNumberSlider },
    { name: 'gradient slider', component: WidgetInputNumberGradientSlider }
  ])(
    'changes the generation mode for a unified $name',
    async ({ component }) => {
      const {
        graph,
        widgetId,
        control: controlWidget
      } = addControlledWidget({
        value: 1,
        options: { values: [1, 2], min: 0, max: 10 }
      })
      vi.mocked(app).rootGraph = graph
      const onNodePointer = vi.fn()
      const Harness = defineComponent({
        components: { WidgetWithControl },
        setup: () => ({ widgetId, component, onNodePointer }),
        template: `
          <div
            @pointerdown="onNodePointer"
            @pointermove="onNodePointer"
            @pointerup="onNodePointer"
          >
            <WidgetWithControl :widget-id :component :model-value="1" />
          </div>
        `
      })
      render(Harness, {
        global: {
          plugins: [
            createI18n({ legacy: false, locale: 'en', messages: { en } })
          ]
        }
      })
      const user = userEvent.setup()

      const control = screen.getByTestId('value-control')
      await user.pointer([
        { target: control, keys: '[MouseLeft>]', coords: { x: 10, y: 10 } },
        { target: control, coords: { x: 30, y: 10 } },
        { target: control, keys: '[/MouseLeft]' }
      ])
      expect(onNodePointer).not.toHaveBeenCalled()
      await user.click(await screen.findByRole('radio', { name: /fixed/i }))

      expect(controlWidget.value).toBe('fixed')
    }
  )

  it('renders the passed component with the widgetId and modelValue', () => {
    const { widgetId } = makeControlWidget()
    mount(widgetId, 42)
    const rendered = screen.getByTestId('rendered')
    expect(rendered).toHaveAttribute('data-widget-id', widgetId)
    expect(rendered).toHaveAttribute('data-model-value', '42')
  })

  it("initializes the mode button from the control widget's mode", () => {
    mount(makeControlWidget('increment').widgetId)
    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'increment'
    )
  })

  it('reflects external mode changes from the store', async () => {
    const { widgetId, control } = makeControlWidget('fixed')
    assert.exists(control.widgetId)
    mount(widgetId)

    useWidgetValueStore().setValue(control.widgetId, 'decrement')
    await nextTick()

    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'decrement'
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('control-button'))
    await user.click(screen.getByTestId('set-fixed'))
    expect(control.value).toBe('fixed')
    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'fixed'
    )
  })

  it('uses the current control binding after the widget is replaced', async () => {
    const original = makeControlWidget('randomize')
    const { rerender } = mount(original.widgetId)
    const replacement = makeControlWidget('increment')

    await rerender({ widgetId: replacement.widgetId })
    expect(screen.getByTestId('control-button')).toHaveAttribute(
      'data-mode',
      'increment'
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('control-button'))
    await user.click(screen.getByTestId('set-fixed'))

    expect(replacement.control.value).toBe('fixed')
    expect(original.control.value).toBe('randomize')
  })

  it('writes the chosen mode to the control widget', async () => {
    const { widgetId, control } = makeControlWidget('randomize')
    mount(widgetId)

    const user = userEvent.setup()
    await user.click(screen.getByTestId('control-button'))
    await user.click(screen.getByTestId('set-fixed'))
    await nextTick()

    expect(control.value).toBe('fixed')
  })

  it('does not call update on initial mount', () => {
    const { widgetId, control } = makeControlWidget('randomize')
    const update = vi.spyOn(control, 'value', 'set')
    mount(widgetId)
    expect(update).not.toHaveBeenCalled()
  })
})
