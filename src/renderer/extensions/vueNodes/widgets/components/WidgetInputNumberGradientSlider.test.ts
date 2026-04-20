/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import InputNumber from 'primevue/inputnumber'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ColorStop } from '@/lib/litegraph/src/interfaces'
import type { IWidgetGradientSliderOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberGradientSlider from './WidgetInputNumberGradientSlider.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

const GradientSliderStub = defineComponent({
  name: 'GradientSlider',
  props: {
    modelValue: { type: Number, default: 0 },
    stops: { type: Array, default: () => [] },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false }
  },
  template: `<div data-testid="gradient-slider"
    :data-stops="JSON.stringify(stops)"
    :data-min="String(min)"
    :data-max="String(max)"
    :data-step="String(step)"
    :data-disabled="String(disabled)" />`
})

const WidgetLayoutFieldStub = defineComponent({
  name: 'WidgetLayoutField',
  props: { widget: { type: Object, default: () => ({}) } },
  template: '<div data-testid="layout-field"><slot /></div>'
})

function makeWidget(
  value: number,
  options: Partial<IWidgetGradientSliderOptions> = {}
): SimplifiedWidget<number, IWidgetGradientSliderOptions> {
  return createMockWidget<number>({
    value,
    name: 'grad',
    type: 'gradientslider',
    options: options as IWidgetGradientSliderOptions
  }) as SimplifiedWidget<number, IWidgetGradientSliderOptions>
}

function renderComponent(
  widget: SimplifiedWidget<number, IWidgetGradientSliderOptions>,
  modelValue: number
) {
  return render(WidgetInputNumberGradientSlider, {
    global: {
      plugins: [PrimeVue, i18n],
      components: { InputNumber },
      stubs: {
        GradientSlider: GradientSliderStub,
        WidgetLayoutField: WidgetLayoutFieldStub
      }
    },
    props: { widget, modelValue }
  })
}

const getGradientSlider = () => screen.getByTestId('gradient-slider')
const getNumberInput = (container: Element) =>
  // eslint-disable-next-line testing-library/no-node-access
  container.querySelector(
    'input[inputmode="decimal"], input[inputmode="numeric"]'
  ) as HTMLInputElement

describe('WidgetInputNumberGradientSlider', () => {
  describe('Value and bounds pass-through', () => {
    it('displays initial value in number input', () => {
      const { container } = renderComponent(makeWidget(42), 42)
      expect(getNumberInput(container).value).toBe('42')
    })

    it('passes min and max from widget options to GradientSlider', () => {
      renderComponent(makeWidget(0, { min: -10, max: 50 }), 0)
      const slider = getGradientSlider()
      expect(Number(slider.dataset.min)).toBe(-10)
      expect(Number(slider.dataset.max)).toBe(50)
    })

    it('defaults min to 0 and max to 100 when unspecified', () => {
      renderComponent(makeWidget(0), 0)
      const slider = getGradientSlider()
      expect(Number(slider.dataset.min)).toBe(0)
      expect(Number(slider.dataset.max)).toBe(100)
    })

    it('passes disabled flag through', () => {
      renderComponent(makeWidget(0, { disabled: true }), 0)
      expect(getGradientSlider().dataset.disabled).toBe('true')
    })
  })

  describe('Gradient stops', () => {
    it('uses black-to-white default when gradient_stops is absent', () => {
      renderComponent(makeWidget(0), 0)
      const stops = JSON.parse(getGradientSlider().dataset.stops!) as ColorStop[]
      expect(stops).toHaveLength(2)
      expect(stops[0]).toMatchObject({ offset: 0, color: [0, 0, 0] })
      expect(stops[1]).toMatchObject({ offset: 1, color: [255, 255, 255] })
    })

    it('uses custom gradient_stops when provided with at least 2 stops', () => {
      const custom: ColorStop[] = [
        { offset: 0, color: [255, 0, 0] },
        { offset: 0.5, color: [0, 255, 0] },
        { offset: 1, color: [0, 0, 255] }
      ]
      renderComponent(makeWidget(0, { gradient_stops: custom }), 0)
      const stops = JSON.parse(getGradientSlider().dataset.stops!) as ColorStop[]
      expect(stops).toEqual(custom)
    })

    it('falls back to default when gradient_stops has fewer than 2 stops', () => {
      const tooFew: ColorStop[] = [{ offset: 0, color: [255, 0, 0] }]
      renderComponent(makeWidget(0, { gradient_stops: tooFew }), 0)
      const stops = JSON.parse(getGradientSlider().dataset.stops!) as ColorStop[]
      expect(stops).toHaveLength(2)
      expect(stops[0].color).toEqual([0, 0, 0])
    })
  })

  describe('Precision', () => {
    it('integer step defaults when precision is unset', () => {
      renderComponent(makeWidget(5), 5)
      expect(Number(getGradientSlider().dataset.step)).toBe(1)
    })

    it('uses 0.1 step when precision is 1', () => {
      renderComponent(makeWidget(5, { precision: 1 }), 5)
      expect(Number(getGradientSlider().dataset.step)).toBe(0.1)
    })

    it('uses explicit step2 value when set', () => {
      renderComponent(makeWidget(5, { step2: 0.25 }), 5)
      expect(Number(getGradientSlider().dataset.step)).toBe(0.25)
    })
  })

  describe('Layout wrapper', () => {
    it('renders inside WidgetLayoutField', () => {
      renderComponent(makeWidget(0), 0)
      expect(screen.getByTestId('layout-field')).toBeInTheDocument()
    })
  })
})
