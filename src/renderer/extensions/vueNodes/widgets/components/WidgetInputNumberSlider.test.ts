import PrimeVue from 'primevue/config'
import InputNumber from 'primevue/inputnumber'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { render } from '@testing-library/vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberSlider from './WidgetInputNumberSlider.vue'
import { createMockWidget } from './widgetTestUtils'

const SliderStub = defineComponent({
  name: 'Slider',
  props: {
    modelValue: { type: Array, default: () => [] },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 }
  },
  template: `<div data-testid="slider" :data-model-value="JSON.stringify(modelValue)" :data-min="String(min)" :data-max="String(max)" :data-step="String(step)" />`
})

function createSliderWidget(
  value: number = 5,
  options: SimplifiedWidget['options'] = {},
  callback?: (value: number) => void
): SimplifiedWidget<number> {
  return createMockWidget<number>({
    value,
    name: 'test_slider',
    type: 'float',
    options: { min: 0, max: 100, step: 1, precision: 0, ...options },
    callback
  })
}

function renderComponent(widget: SimplifiedWidget<number>, modelValue: number) {
  return render(WidgetInputNumberSlider, {
    global: {
      plugins: [PrimeVue],
      components: { InputNumber },
      stubs: { Slider: SliderStub }
    },
    props: {
      widget,
      modelValue
    }
  })
}

function getSlider(container: Element) {
  return container.querySelector('[data-testid="slider"]') as HTMLElement
}

function getNumberInput(container: Element) {
  return container.querySelector(
    'input[inputmode="numeric"]'
  ) as HTMLInputElement
}

describe('WidgetInputNumberSlider Value Binding', () => {
  describe('Props and Values', () => {
    it('passes modelValue to slider component', () => {
      const widget = createSliderWidget(5)
      const { container } = renderComponent(widget, 5)

      const slider = getSlider(container)
      expect(JSON.parse(slider.dataset.modelValue!)).toEqual([5])
    })

    it('handles different initial values', () => {
      const widget1 = createSliderWidget(5)
      const { container: container1 } = renderComponent(widget1, 5)

      const widget2 = createSliderWidget(10)
      const { container: container2 } = renderComponent(widget2, 10)

      const slider1 = getSlider(container1)
      expect(JSON.parse(slider1.dataset.modelValue!)).toEqual([5])

      const slider2 = getSlider(container2)
      expect(JSON.parse(slider2.dataset.modelValue!)).toEqual([10])
    })
  })

  describe('Component Rendering', () => {
    it('renders slider component', () => {
      const widget = createSliderWidget(5)
      const { container } = renderComponent(widget, 5)

      expect(getSlider(container)).not.toBeNull()
    })

    it('renders input field', () => {
      const widget = createSliderWidget(5)
      const { container } = renderComponent(widget, 5)

      expect(getNumberInput(container)).not.toBeNull()
    })

    it('displays initial value in input field', () => {
      const widget = createSliderWidget(42)
      const { container } = renderComponent(widget, 42)

      const input = getNumberInput(container)
      expect(input.value).toBe('42')
    })
  })

  describe('Widget Options', () => {
    it('passes widget options to PrimeVue components', () => {
      const widget = createSliderWidget(5, { min: -10, max: 50 })
      const { container } = renderComponent(widget, 5)

      const slider = getSlider(container)
      expect(Number(slider.dataset.min)).toBe(-10)
      expect(Number(slider.dataset.max)).toBe(50)
    })

    it('handles negative value ranges', () => {
      const widget = createSliderWidget(0, { min: -100, max: 100 })
      const { container } = renderComponent(widget, 0)

      const slider = getSlider(container)
      expect(Number(slider.dataset.min)).toBe(-100)
      expect(Number(slider.dataset.max)).toBe(100)
    })

    describe('Step Size', () => {
      it('should default to 1', () => {
        const widget = createSliderWidget(5)
        const { container } = renderComponent(widget, 5)

        const slider = getSlider(container)
        expect(Number(slider.dataset.step)).toBe(1)
      })

      it('should get the step2 value if present', () => {
        const widget = createSliderWidget(5, { step2: 0.01 })
        const { container } = renderComponent(widget, 5)

        const slider = getSlider(container)
        expect(Number(slider.dataset.step)).toBe(0.01)
      })

      it('should be 1 for precision 0', () => {
        const widget = createSliderWidget(5, { precision: 0 })
        const { container } = renderComponent(widget, 5)

        const slider = getSlider(container)
        expect(Number(slider.dataset.step)).toBe(1)
      })

      it('should be .1 for precision 1', () => {
        const widget = createSliderWidget(5, { precision: 1 })
        const { container } = renderComponent(widget, 5)

        const slider = getSlider(container)
        expect(Number(slider.dataset.step)).toBe(0.1)
      })

      it('should be .00001 for precision 5', () => {
        const widget = createSliderWidget(5, { precision: 5 })
        const { container } = renderComponent(widget, 5)

        const slider = getSlider(container)
        expect(Number(slider.dataset.step)).toBe(0.00001)
      })
    })
  })
})
