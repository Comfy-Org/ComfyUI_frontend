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

function mountComponent(widget: SimplifiedWidget<number>, modelValue: number) {
  return mount(WidgetInputNumberInput, {
    global: {
      plugins: [PrimeVue],
      components: { InputNumber }
    },
    props: {
      widget,
      modelValue
    }
  })
}

function getNumberInput(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.get<HTMLInputElement>('input[inputmode="numeric"]')
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
  it('displays numbers without commas by default for int widgets', () => {
    const widget = createMockWidget(1000, 'int')
    const wrapper = mountComponent(widget, 1000)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers without commas by default for float widgets', () => {
    const widget = createMockWidget(1000.5, 'float')
    const wrapper = mountComponent(widget, 1000.5)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('1000.5')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers with commas when grouping enabled', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: true })
    const wrapper = mountComponent(widget, 1000)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('1,000')
    expect(input.value).toContain(',')
  })

  it('displays numbers without commas when grouping explicitly disabled', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: false })
    const wrapper = mountComponent(widget, 1000)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers without commas when useGrouping option is undefined', () => {
    const widget = createMockWidget(1000, 'int', { useGrouping: undefined })
    const wrapper = mountComponent(widget, 1000)

    const input = getNumberInput(wrapper)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })
})

describe('WidgetInputNumberInput Large Integer Precision Handling', () => {
  const SAFE_INTEGER_MAX = Number.MAX_SAFE_INTEGER // 9,007,199,254,740,991
  const UNSAFE_LARGE_INTEGER = 18446744073709552000 // Example seed value that exceeds safe range

  it('shows buttons for safe integer values', () => {
    const widget = createMockWidget(1000, 'int')
    const wrapper = mountComponent(widget, 1000)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(true)
  })

  it('shows buttons for values at safe integer limit', () => {
    const widget = createMockWidget(SAFE_INTEGER_MAX, 'int')
    const wrapper = mountComponent(widget, SAFE_INTEGER_MAX)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(true)
  })

  it('hides buttons for unsafe large integer values', () => {
    const widget = createMockWidget(UNSAFE_LARGE_INTEGER, 'int')
    const wrapper = mountComponent(widget, UNSAFE_LARGE_INTEGER)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(false)
  })

  it('hides buttons for unsafe negative integer values', () => {
    const unsafeNegative = -UNSAFE_LARGE_INTEGER
    const widget = createMockWidget(unsafeNegative, 'int')
    const wrapper = mountComponent(widget, unsafeNegative)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(false)
  })

  it('shows tooltip for disabled buttons due to precision limits', (context) => {
    context.skip('needs diagnosis')
    const widget = createMockWidget(UNSAFE_LARGE_INTEGER, 'int')
    const wrapper = mountComponent(widget, UNSAFE_LARGE_INTEGER)

    // Check that tooltip wrapper div exists
    const tooltipDiv = wrapper.find('div[v-tooltip]')
    expect(tooltipDiv.exists()).toBe(true)
  })

  it('does not show tooltip for safe integer values', () => {
    const widget = createMockWidget(1000, 'int')
    const wrapper = mountComponent(widget, 1000)

    // For safe values, tooltip should not be set (computed returns null)
    const tooltipDiv = wrapper.find('div')
    expect(tooltipDiv.attributes('v-tooltip')).toBeUndefined()
  })

  it('handles edge case of zero value', () => {
    const widget = createMockWidget(0, 'int')
    const wrapper = mountComponent(widget, 0)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(true)
  })

  it('correctly identifies safe vs unsafe integers using Number.isSafeInteger', () => {
    // Test the JavaScript behavior our component relies on
    expect(Number.isSafeInteger(SAFE_INTEGER_MAX)).toBe(true)
    expect(Number.isSafeInteger(SAFE_INTEGER_MAX + 1)).toBe(false)
    expect(Number.isSafeInteger(UNSAFE_LARGE_INTEGER)).toBe(false)
    expect(Number.isSafeInteger(-SAFE_INTEGER_MAX)).toBe(true)
    expect(Number.isSafeInteger(-SAFE_INTEGER_MAX - 1)).toBe(false)
  })

  it('handles floating point values correctly', (context) => {
    context.skip('needs diagnosis')

    const safeFloat = 1000.5
    const widget = createMockWidget(safeFloat, 'float')
    const wrapper = mountComponent(widget, safeFloat)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(true)
  })

  it('hides buttons for unsafe floating point values', (context) => {
    context.skip('needs diagnosis')

    const unsafeFloat = UNSAFE_LARGE_INTEGER + 0.5
    const widget = createMockWidget(unsafeFloat, 'float')
    const wrapper = mountComponent(widget, unsafeFloat)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(false)
  })
})

describe('WidgetInputNumberInput Edge Cases for Precision Handling', () => {
  it('handles null/undefined model values gracefully', () => {
    const widget = createMockWidget(0, 'int')
    // Mount with undefined as modelValue
    const wrapper = mount(WidgetInputNumberInput, {
      global: {
        plugins: [PrimeVue],
        components: { InputNumber }
      },
      props: {
        widget,
        modelValue: undefined as any
      }
    })

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(true) // Should default to safe behavior
  })

  it('handles NaN values gracefully', (context) => {
    context.skip('needs diagnosis')
    const widget = createMockWidget(NaN, 'int')
    const wrapper = mountComponent(widget, NaN)

    const inputNumber = wrapper.findComponent(InputNumber)
    // NaN is not a safe integer, so buttons should be hidden
    expect(inputNumber.props('showButtons')).toBe(false)
  })

  it('handles Infinity values', () => {
    const widget = createMockWidget(Infinity, 'int')
    const wrapper = mountComponent(widget, Infinity)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(false)
  })

  it('handles negative Infinity values', () => {
    const widget = createMockWidget(-Infinity, 'int')
    const wrapper = mountComponent(widget, -Infinity)

    const inputNumber = wrapper.findComponent(InputNumber)
    expect(inputNumber.props('showButtons')).toBe(false)
  })
})
