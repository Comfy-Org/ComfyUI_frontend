import { fireEvent, render, screen } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IColorWidgetOptions } from '@comfyorg/graph-model/widgets'

import WidgetColorPicker from './WidgetColorPicker.vue'
import { registerTestWidget } from './widgetTestUtils'

const AppColorPickerStub = defineComponent({
  name: 'AppColorPicker',
  props: {
    modelValue: { type: String, default: '' },
    alpha: { type: Boolean, default: true }
  },
  emits: ['update:modelValue'],
  template: `<input
    data-testid="color-picker-input"
    :data-alpha="alpha"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />`
})

describe('WidgetColorPicker Value Binding', () => {
  const createColorWidget = (
    value: string | number = '#000000',
    options: IColorWidgetOptions = {}
  ) =>
    registerTestWidget({
      value,
      name: 'test_color_picker',
      type: 'color',
      options
    })

  const renderComponent = (
    widgetId: WidgetId,
    modelValue: string | number,
    extraProps: Record<string, unknown> = {}
  ) => {
    return render(WidgetColorPicker, {
      global: {
        stubs: {
          AppColorPicker: AppColorPickerStub
        }
      },
      props: {
        widgetId,
        modelValue,
        ...extraProps
      }
    })
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when color changes', async () => {
      const onUpdateModelValue = vi.fn()
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000', {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByTestId('color-picker-input')
      await fireEvent.update(input, '#00ff00')

      expect(onUpdateModelValue).toHaveBeenCalledWith('#00ff00')
    })

    it('round-trips integer-backed colors including zero', async () => {
      const onUpdateModelValue = vi.fn()
      const widget = createColorWidget(0, { format: 'int' })
      renderComponent(widget, 0, {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByTestId('color-picker-input')
      expect(input).toHaveValue('#000000')
      expect(input).toHaveAttribute('data-alpha', 'false')

      await fireEvent.update(input, '#00ff00')
      expect(onUpdateModelValue).toHaveBeenCalledWith(0x00ff00)

      await fireEvent.update(input, '#000000')
      expect(onUpdateModelValue).toHaveBeenCalledWith(0)
    })
  })

  describe('Widget Layout Integration', () => {
    it('labels the layout field with the widget name', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      expect(screen.getByTestId('widget-layout-field-label')).toHaveTextContent(
        'test_color_picker'
      )
    })
  })

  describe('Edge Cases', () => {
    it('renders color picker with empty value', () => {
      const widget = createColorWidget('')
      renderComponent(widget, '')

      const input = screen.getByTestId('color-picker-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('#000000')
    })
  })
})
