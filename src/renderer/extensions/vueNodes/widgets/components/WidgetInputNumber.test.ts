/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import type {
  SafeControlWidget,
  SimplifiedWidget
} from '@/types/simplifiedWidget'

import WidgetInputNumber from './WidgetInputNumber.vue'
import { createMockWidget } from './widgetTestUtils'

const variantStub = (name: string, testid: string) =>
  defineComponent({
    name,
    props: { widget: { type: Object, default: () => ({}) }, modelValue: { type: Number, default: 0 } },
    template: `<div data-testid="${testid}" :data-model-value="String(modelValue)" :data-widget-type="widget?.type" />`
  })

const WithControlStub = defineComponent({
  name: 'WidgetWithControl',
  props: {
    widget: { type: Object, default: () => ({}) },
    modelValue: { type: Number, default: 0 },
    component: { type: Object, default: null }
  },
  template:
    '<div data-testid="widget-with-control" :data-model-value="String(modelValue)" />'
})

const globalConfig = {
  stubs: {
    WidgetInputNumberInput: variantStub('WidgetInputNumberInput', 'variant-input'),
    WidgetInputNumberSlider: variantStub('WidgetInputNumberSlider', 'variant-slider'),
    WidgetInputNumberGradientSlider: variantStub(
      'WidgetInputNumberGradientSlider',
      'variant-gradient'
    ),
    WidgetWithControl: WithControlStub
  }
}

const makeWidget = (
  type: string,
  overrides: Partial<SimplifiedWidget<number>> = {}
): SimplifiedWidget<number> =>
  createMockWidget<number>({
    value: 0,
    name: 'num',
    type,
    options: {},
    ...overrides
  })

const mount = (widget: SimplifiedWidget<number>, modelValue = 0) =>
  render(WidgetInputNumber, {
    global: globalConfig,
    props: { widget, modelValue }
  })

describe('WidgetInputNumber variant selection', () => {
  it('renders input variant for type "int"', () => {
    mount(makeWidget('int'))
    expect(screen.getByTestId('variant-input')).toBeInTheDocument()
    expect(screen.queryByTestId('variant-slider')).not.toBeInTheDocument()
    expect(screen.queryByTestId('variant-gradient')).not.toBeInTheDocument()
  })

  it('renders input variant for type "float"', () => {
    mount(makeWidget('float'))
    expect(screen.getByTestId('variant-input')).toBeInTheDocument()
  })

  it('renders slider variant for type "slider"', () => {
    mount(makeWidget('slider'))
    expect(screen.getByTestId('variant-slider')).toBeInTheDocument()
    expect(screen.queryByTestId('variant-input')).not.toBeInTheDocument()
  })

  it('renders gradient-slider variant for type "gradientslider"', () => {
    mount(makeWidget('gradientslider'))
    expect(screen.getByTestId('variant-gradient')).toBeInTheDocument()
    expect(screen.queryByTestId('variant-input')).not.toBeInTheDocument()
  })

  it('falls back to input variant for unknown type', () => {
    mount(makeWidget('unknownType'))
    expect(screen.getByTestId('variant-input')).toBeInTheDocument()
  })
})

describe('WidgetInputNumber control-widget wrapping', () => {
  const controlWidget: SafeControlWidget = {
    value: 'randomize',
    update: () => {}
  }

  it('wraps in WidgetWithControl when widget has controlWidget', () => {
    mount(makeWidget('int', { controlWidget }))
    expect(screen.getByTestId('widget-with-control')).toBeInTheDocument()
    expect(screen.queryByTestId('variant-input')).not.toBeInTheDocument()
  })

  it('does not wrap when controlWidget is absent', () => {
    mount(makeWidget('int'))
    expect(screen.queryByTestId('widget-with-control')).not.toBeInTheDocument()
    expect(screen.getByTestId('variant-input')).toBeInTheDocument()
  })

  it('forwards modelValue to the rendered variant', () => {
    mount(makeWidget('slider'), 42)
    expect(screen.getByTestId('variant-slider')).toHaveAttribute(
      'data-model-value',
      '42'
    )
  })

  it('forwards modelValue to WidgetWithControl when wrapping', () => {
    mount(makeWidget('int', { controlWidget }), 7)
    expect(screen.getByTestId('widget-with-control')).toHaveAttribute(
      'data-model-value',
      '7'
    )
  })
})
