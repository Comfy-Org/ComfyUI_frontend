import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputNumber from 'primevue/inputnumber'
import { describe, expect, it } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'

function createMockWidget(
  value: number = 0,
  type: 'int' | 'float' = 'int',
  options: SimplifiedWidget['options'] = {},
  callback?: (value: number) => void
): SimplifiedWidget<number> {
  return {
    name: 'test_input_number',
    type,
    value,
    options,
    callback
  }
}

function mountComponent(
  widget: SimplifiedWidget<number>,
  modelValue: number,
  readonly = false
) {
  return mount(WidgetInputNumberInput, {
    global: {
      plugins: [PrimeVue],
      components: { InputNumber }
    },
    props: {
      widget,
      modelValue,
      readonly
    }
  })
}

function getNumberInput(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('input[inputmode="numeric"]')
  if (!(input.element instanceof HTMLInputElement)) {
    throw new Error(
      'Number input element not found or is not an HTMLInputElement'
    )
  }
  return input.element
}

describe('WidgetInputNumberInput Value Binding', () => {
  it('displays initial value in input field', () => {
    const widget = createMockWidget(42, 'int')
    const wrapper = mountComponent(widget, 42)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('42')
  })

  it('emits update:modelValue when value changes', async () => {
    const widget = createMockWidget(10, 'int')
    const wrapper = mountComponent(widget, 10)

    const inputNumber = wrapper.findComponent(InputNumber)
    await inputNumber.vm.$emit('update:modelValue', 20)

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toContain(20)
  })

  it('handles negative values', () => {
    const widget = createMockWidget(-5, 'int')
    const wrapper = mountComponent(widget, -5)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('-5')
  })

  it('handles decimal values for float type', () => {
    const widget = createMockWidget(3.14, 'float')
    const wrapper = mountComponent(widget, 3.14)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('3.14')
  })
})

describe('WidgetInputNumberInput Component Rendering', () => {
  it('renders InputNumber component with show-buttons', () => {
    const widget = createMockWidget(5, 'int')
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.exists()).toBe(true)
    expect(inputNumber.props('showButtons')).toBe(true)
  })

  it('disables input when readonly', () => {
    const widget = createMockWidget(5, 'int', {}, undefined)
    const wrapper = mountComponent(widget, 5, true)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('disabled')).toBe(true)
  })

  it('sets button layout to horizontal', () => {
    const widget = createMockWidget(5, 'int')
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('buttonLayout')).toBe('horizontal')
  })

  it('sets size to small', () => {
    const widget = createMockWidget(5, 'int')
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('size')).toBe('small')
  })
})

describe('WidgetInputNumberInput Step Value', () => {
  it('defaults to 0 for unrestricted stepping', () => {
    const widget = createMockWidget(5, 'int')
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('step')).toBe(0)
  })

  it('uses step2 value when provided', () => {
    const widget = createMockWidget(5, 'int', { step2: 0.5 })
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('step')).toBe(0.5)
  })

  it('calculates step from precision for precision 0', () => {
    const widget = createMockWidget(5, 'int', { precision: 0 })
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('step')).toBe(1)
  })

  it('calculates step from precision for precision 1', () => {
    const widget = createMockWidget(5, 'float', { precision: 1 })
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('step')).toBe(0.1)
  })

  it('calculates step from precision for precision 2', () => {
    const widget = createMockWidget(5, 'float', { precision: 2 })
    const wrapper = mountComponent(widget, 5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('step')).toBe(0.01)
  })
})

describe('WidgetInputNumberInput Grouping Behavior', () => {
  it('disables grouping by default for int widgets', () => {
    const widget = createMockWidget(1000, 'int')
    const wrapper = mountComponent(widget, 1000)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('useGrouping')).toBe(false)
  })

  it('disables grouping by default for float widgets', () => {
    const widget = createMockWidget(1000.5, 'float')
    const wrapper = mountComponent(widget, 1000.5)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('useGrouping')).toBe(false)
  })

  it('enables grouping when explicitly set to true in widget options', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: true })
    const wrapper = mountComponent(widget, 1000)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('useGrouping')).toBe(true)
  })

  it('keeps grouping disabled when explicitly set to false', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: false })
    const wrapper = mountComponent(widget, 1000)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('useGrouping')).toBe(false)
  })

  it('disables grouping when useGrouping option is undefined', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: undefined })
    const wrapper = mountComponent(widget, 1000)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('useGrouping')).toBe(false)
  })
})
