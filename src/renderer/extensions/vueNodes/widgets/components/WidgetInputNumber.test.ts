import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { app } from '@/scripts/app'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import WidgetInputNumber from './WidgetInputNumber.vue'
import { addControlledWidget } from './controlledWidgetFixture'
import { registerTestWidget } from './widgetTestUtils'

vi.mock(import('@/scripts/app'))

const variantStub = (name: string, testid: string) =>
  defineComponent({
    name,
    props: {
      widgetId: { type: String, required: true },
      modelValue: { type: Number, default: 0 }
    },
    template: `<div data-testid="${testid}" :data-model-value="String(modelValue)" :data-widget-id="widgetId" />`
  })

const WithControlStub = defineComponent({
  name: 'WidgetWithControl',
  props: {
    widgetId: { type: String, required: true },
    modelValue: { type: Number, default: 0 },
    component: { type: Object, default: null }
  },
  template:
    '<div data-testid="widget-with-control" :data-model-value="String(modelValue)" />'
})

const globalConfig = {
  stubs: {
    WidgetInputNumberInput: variantStub(
      'WidgetInputNumberInput',
      'variant-input'
    ),
    WidgetInputNumberSlider: variantStub(
      'WidgetInputNumberSlider',
      'variant-slider'
    ),
    WidgetInputNumberGradientSlider: variantStub(
      'WidgetInputNumberGradientSlider',
      'variant-gradient'
    ),
    WidgetWithControl: WithControlStub
  }
}

const makeWidget = (type: string): WidgetId =>
  registerTestWidget({ value: 0, name: 'num', type })

const makeControlledWidget = (): WidgetId => {
  const { graph, widgetId } = addControlledWidget()
  vi.mocked(app).rootGraph = graph
  return widgetId
}

const mount = (widgetId: WidgetId, modelValue = 0) =>
  render(WidgetInputNumber, {
    global: globalConfig,
    props: { widgetId, modelValue }
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
  it('wraps in WidgetWithControl when widget has controlWidget', () => {
    mount(makeControlledWidget())
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
    mount(makeControlledWidget(), 7)
    expect(screen.getByTestId('widget-with-control')).toHaveAttribute(
      'data-model-value',
      '7'
    )
  })
})
