import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'

import WidgetColorPicker from './WidgetColorPicker.vue'
import { createMockWidget } from './widgetTestUtils'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

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

  const mountComponent = (
    widget: SimplifiedWidget<string>,
    modelValue: string
  ) => {
    return mount(WidgetColorPicker, {
      global: {
        components: {
          ColorPicker,
          WidgetLayoutField
        }
      },
      props: {
        widget,
        modelValue
      }
    })
  }

  describe('Vue Event Emission', () => {
    it('emits Vue event when color changes', async () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const colorPicker = wrapper.findComponent(ColorPicker)
      await colorPicker.vm.$emit('update:modelValue', '#00ff00')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('#00ff00')
    })

    it('handles missing callback gracefully', async () => {
      const widget = createColorWidget('#000000', {}, undefined)
      const wrapper = mountComponent(widget, '#000000')

      const colorPicker = wrapper.findComponent(ColorPicker)
      await colorPicker.vm.$emit('update:modelValue', '#ff00ff')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toContain('#ff00ff')
    })
  })

  describe('Component Rendering', () => {
    it('renders color picker component', () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const colorPicker = wrapper.findComponent(ColorPicker)
      expect(colorPicker.exists()).toBe(true)
    })

    it('renders layout field wrapper', () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const layoutField = wrapper.findComponent({
        name: 'WidgetLayoutField'
      })
      expect(layoutField.exists()).toBe(true)
    })

    it('uses default color when no value provided', () => {
      const widget = createColorWidget('')
      const wrapper = mountComponent(widget, '')

      const colorPicker = wrapper.findComponent(ColorPicker)
      expect(colorPicker.exists()).toBe(true)
    })
  })

  describe('Widget Layout Integration', () => {
    it('passes widget to layout field', () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const layoutField = wrapper.findComponent({
        name: 'WidgetLayoutField'
      })
      expect(layoutField.props('widget')).toEqual(widget)
    })

    it('maintains proper component structure', () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const layoutField = wrapper.findComponent({
        name: 'WidgetLayoutField'
      })
      const colorPicker = wrapper.findComponent(ColorPicker)

      expect(layoutField.exists()).toBe(true)
      expect(colorPicker.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty color value', () => {
      const widget = createColorWidget('')
      const wrapper = mountComponent(widget, '')

      const colorPicker = wrapper.findComponent(ColorPicker)
      expect(colorPicker.exists()).toBe(true)
    })

    it('handles widget with no options', () => {
      const widget = createColorWidget('#ff0000')
      const wrapper = mountComponent(widget, '#ff0000')

      const colorPicker = wrapper.findComponent(ColorPicker)
      expect(colorPicker.exists()).toBe(true)
    })
  })
})
