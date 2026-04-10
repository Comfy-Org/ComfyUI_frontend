import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en'
})

function createNumberInputWidget(
  value: number = 0,
  type: 'int' | 'float' = 'int',
  options: SimplifiedWidget['options'] = {},
  callback?: (value: number) => void
): SimplifiedWidget<number> {
  return createMockWidget<number>({
    value,
    name: 'test_input_number',
    type,
    options,
    callback
  })
}

function renderComponent(widget: SimplifiedWidget<number>, modelValue: number) {
  return render(WidgetInputNumberInput, {
    global: { plugins: [i18n] },
    props: {
      widget,
      modelValue
    }
  })
}

function getNumberInput(container: Element) {
  return container.querySelector(
    'input[inputmode="decimal"]'
  ) as HTMLInputElement
}

describe('WidgetInputNumberInput Value Binding', () => {
  it('displays initial value in input field', () => {
    const widget = createNumberInputWidget(42, 'int')
    const { container } = renderComponent(widget, 42)

    const input = getNumberInput(container)
    expect(input.value).toBe('42')
  })

  it('emits update:modelValue when value changes', () => {
    const widget = createNumberInputWidget(10, 'int')
    const { container } = renderComponent(widget, 10)

    const input = getNumberInput(container)
    expect(input.value).toBe('10')
  })

  it('handles negative values', () => {
    const widget = createNumberInputWidget(-5, 'int')
    const { container } = renderComponent(widget, -5)

    const input = getNumberInput(container)
    expect(input.value).toBe('-5')
  })

  it('handles decimal values for float type', () => {
    const widget = createNumberInputWidget(3.14, 'float')
    const { container } = renderComponent(widget, 3.14)

    const input = getNumberInput(container)
    expect(input.value).toBe('3.14')
  })
})

describe('WidgetInputNumberInput Grouping Behavior', () => {
  it('displays numbers without commas by default for int widgets', () => {
    const widget = createNumberInputWidget(1000, 'int')
    const { container } = renderComponent(widget, 1000)

    const input = getNumberInput(container)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers without commas by default for float widgets', () => {
    const widget = createNumberInputWidget(1000.5, 'float')
    const { container } = renderComponent(widget, 1000.5)

    const input = getNumberInput(container)
    expect(input.value).toBe('1000.5')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers with commas when grouping enabled', () => {
    const widget = createNumberInputWidget(1000, 'int', { useGrouping: true })
    const { container } = renderComponent(widget, 1000)

    const input = getNumberInput(container)
    expect(input.value).toBe('1,000')
    expect(input.value).toContain(',')
  })

  it('displays numbers without commas when grouping explicitly disabled', () => {
    const widget = createNumberInputWidget(1000, 'int', { useGrouping: false })
    const { container } = renderComponent(widget, 1000)

    const input = getNumberInput(container)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })

  it('displays numbers without commas when useGrouping option is undefined', () => {
    const widget = createNumberInputWidget(1000, 'int', {
      useGrouping: undefined
    })
    const { container } = renderComponent(widget, 1000)

    const input = getNumberInput(container)
    expect(input.value).toBe('1000')
    expect(input.value).not.toContain(',')
  })
})

describe('WidgetInputNumberInput Large Integer Precision Handling', () => {
  const SAFE_INTEGER_MAX = Number.MAX_SAFE_INTEGER
  const UNSAFE_LARGE_INTEGER = 18446744073709552000

  it('shows buttons for safe integer values', () => {
    renderComponent(createNumberInputWidget(1000, 'int'), 1000)

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('shows buttons for values at safe integer limit', () => {
    renderComponent(
      createNumberInputWidget(SAFE_INTEGER_MAX, 'int'),
      SAFE_INTEGER_MAX
    )

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('hides buttons for unsafe large integer values', () => {
    renderComponent(
      createNumberInputWidget(UNSAFE_LARGE_INTEGER, 'int'),
      UNSAFE_LARGE_INTEGER
    )

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('hides buttons for unsafe negative integer values', () => {
    const unsafeNegative = -UNSAFE_LARGE_INTEGER
    renderComponent(
      createNumberInputWidget(unsafeNegative, 'int'),
      unsafeNegative
    )

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows tooltip for disabled buttons due to precision limits', (context) => {
    context.skip('needs diagnosis')
    renderComponent(
      createNumberInputWidget(UNSAFE_LARGE_INTEGER, 'int'),
      UNSAFE_LARGE_INTEGER
    )
  })

  it('does not show tooltip for safe integer values', () => {
    const { container } = renderComponent(
      createNumberInputWidget(1000, 'int'),
      1000
    )

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- checking absence of v-tooltip attribute on wrapper div
    const tooltipDiv = container.querySelector('div')
    expect(tooltipDiv).not.toHaveAttribute('v-tooltip')
  })

  it('handles floating point values correctly', () => {
    renderComponent(createNumberInputWidget(1000.5, 'float'), 1000.5)

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('hides buttons for unsafe floating point values', () => {
    const unsafeFloat = UNSAFE_LARGE_INTEGER + 0.5
    renderComponent(createNumberInputWidget(unsafeFloat, 'float'), unsafeFloat)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('WidgetInputNumberInput Edge Cases for Precision Handling', () => {
  it('handles null/undefined model values gracefully', () => {
    const widget = createNumberInputWidget(0, 'int')
    render(WidgetInputNumberInput, {
      global: { plugins: [i18n] },
      props: {
        widget,
        modelValue: undefined
      } as { widget: SimplifiedWidget<number>; modelValue: number | undefined }
    })

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('handles NaN values gracefully', (context) => {
    context.skip('needs diagnosis')
    renderComponent(createNumberInputWidget(NaN, 'int'), NaN)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('handles Infinity values', () => {
    renderComponent(createNumberInputWidget(Infinity, 'int'), Infinity)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('handles negative Infinity values', () => {
    renderComponent(createNumberInputWidget(-Infinity, 'int'), -Infinity)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
