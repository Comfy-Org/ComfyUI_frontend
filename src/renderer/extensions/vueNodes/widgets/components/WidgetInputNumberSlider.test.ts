import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import type { SliderProps } from 'primevue/slider'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'

describe('WidgetInputNumberSlider Value Binding', () => {
  const createMockWidget = (
    value: number = 5,
    options: Partial<SliderProps & { precision?: number }> = {},
    callback?: (value: number) => void
  ): SimplifiedWidget<number> => ({
    name: 'test_slider',
    type: 'float',
    value,
    options: { min: 0, max: 100, step: 1, precision: 0, ...options },
    callback
  })

  const mountComponent = (
    widget: SimplifiedWidget<number>,
    modelValue: number,
    readonly = false
  ) => {
    return mount(WidgetInputNumberSlider, {
      global: {
        plugins: [PrimeVue],
        components: { InputText, Slider }
      },
      props: {
        widget,
        modelValue,
        readonly
      }
    })
  }

  const getNumberInput = (wrapper: ReturnType<typeof mount>) => {
    const input = wrapper.find('input[type="number"]')
    if (!(input.element instanceof HTMLInputElement)) {
      throw new Error(
        'Number input element not found or is not an HTMLInputElement'
      )
    }
    return { element: input.element }
  }

  describe('Props and Values', () => {
    it('passes modelValue to slider component', () => {
      const widget = createMockWidget(5)
      const wrapper = mountComponent(widget, 5)

      const slider = wrapper.findComponent({ name: 'Slider' })
      expect(slider.props('modelValue')).toEqual([5])
    })

    it('handles different initial values', () => {
      const widget1 = createMockWidget(5)
      const wrapper1 = mountComponent(widget1, 5)

      const widget2 = createMockWidget(10)
      const wrapper2 = mountComponent(widget2, 10)

      const slider1 = wrapper1.findComponent({ name: 'Slider' })
      expect(slider1.props('modelValue')).toEqual([5])

      const slider2 = wrapper2.findComponent({ name: 'Slider' })
      expect(slider2.props('modelValue')).toEqual([10])
    })
  })

  describe('Component Rendering', () => {
    it('renders slider component', () => {
      const widget = createMockWidget(5)
      const wrapper = mountComponent(widget, 5)

      expect(wrapper.findComponent({ name: 'Slider' }).exists()).toBe(true)
    })

    it('renders input field', () => {
      const widget = createMockWidget(5)
      const wrapper = mountComponent(widget, 5)

      expect(wrapper.find('input[type="number"]').exists()).toBe(true)
    })

    it('displays initial value in input field', () => {
      const widget = createMockWidget(42)
      const wrapper = mountComponent(widget, 42)

      const input = getNumberInput(wrapper)
      expect(input.element.value).toBe('42')
    })

    it('disables components in readonly mode', () => {
      const widget = createMockWidget(5)
      const wrapper = mountComponent(widget, 5, true)

      const slider = wrapper.findComponent({ name: 'Slider' })
      expect(slider.props('disabled')).toBe(true)

      const input = getNumberInput(wrapper)
      expect(input.element.disabled).toBe(true)
    })
  })

  describe('Widget Options', () => {
    it('passes widget options to PrimeVue components', () => {
      const widget = createMockWidget(5, { min: -10, max: 50 })
      const wrapper = mountComponent(widget, 5)

      const slider = wrapper.findComponent({ name: 'Slider' })
      expect(slider.props('min')).toBe(-10)
      expect(slider.props('max')).toBe(50)
    })

    it('handles negative value ranges', () => {
      const widget = createMockWidget(0, { min: -100, max: 100 })
      const wrapper = mountComponent(widget, 0)

      const slider = wrapper.findComponent({ name: 'Slider' })
      expect(slider.props('min')).toBe(-100)
      expect(slider.props('max')).toBe(100)
    })
  })
})
