/* eslint-disable vue/one-component-per-file */
/* eslint-disable vue/no-unused-emit-declarations */
import { fireEvent, render, screen } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetColorPicker from './WidgetColorPicker.vue'
import { createMockWidget } from './widgetTestUtils'

const WidgetLayoutFieldStub = defineComponent({
  name: 'WidgetLayoutField',
  props: {
    widget: { type: Object, default: () => ({}) }
  },
  template:
    '<div data-testid="layout-field" :data-widget-name="widget.name"><slot /></div>'
})

const ColorPickerStub = defineComponent({
  name: 'ColorPicker',
  props: {
    modelValue: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  template: `<input
    data-testid="color-picker-input"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />`
})

describe('WidgetColorPicker Value Binding', () => {
  const createColorWidget = (
    value: string = '#000000',
    options: Record<string, unknown> = {},
    callback?: (value: string) => void
  ) =>
    createMockWidget<string>({
      value,
      name: 'test_color_picker',
      type: 'color',
      options,
      callback
    })

  const renderComponent = (
    widget: SimplifiedWidget<string>,
    modelValue: string,
    extraProps: Record<string, unknown> = {}
  ) => {
    return render(WidgetColorPicker, {
      global: {
        stubs: {
          ColorPicker: ColorPickerStub,
          WidgetLayoutField: WidgetLayoutFieldStub
        }
      },
      props: {
        widget,
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

    it('handles missing callback gracefully', async () => {
      const onUpdateModelValue = vi.fn()
      const widget = createColorWidget('#000000', {}, undefined)
      renderComponent(widget, '#000000', {
        'onUpdate:modelValue': onUpdateModelValue
      })

      const input = screen.getByTestId('color-picker-input')
      await fireEvent.update(input, '#ff00ff')

      expect(onUpdateModelValue).toHaveBeenCalledWith('#ff00ff')
    })
  })

  describe('Component Rendering', () => {
    it('renders color picker component', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      expect(screen.getByTestId('color-picker-input')).toBeInTheDocument()
    })

    it('renders layout field wrapper', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      expect(screen.getByTestId('layout-field')).toBeInTheDocument()
    })

    it('uses default color when no value provided', () => {
      const widget = createColorWidget('')
      renderComponent(widget, '')

      expect(screen.getByTestId('color-picker-input')).toBeInTheDocument()
    })
  })

  describe('Widget Layout Integration', () => {
    it('passes widget to layout field', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      const layoutField = screen.getByTestId('layout-field')
      expect(layoutField.getAttribute('data-widget-name')).toBe(
        'test_color_picker'
      )
    })

    it('maintains proper component structure', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      expect(screen.getByTestId('layout-field')).toBeInTheDocument()
      expect(screen.getByTestId('color-picker-input')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty color value', () => {
      const widget = createColorWidget('')
      renderComponent(widget, '')

      expect(screen.getByTestId('color-picker-input')).toBeInTheDocument()
    })

    it('handles widget with no options', () => {
      const widget = createColorWidget('#ff0000')
      renderComponent(widget, '#ff0000')

      expect(screen.getByTestId('color-picker-input')).toBeInTheDocument()
    })
  })
})
