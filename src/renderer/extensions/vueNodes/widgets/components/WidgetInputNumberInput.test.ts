import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'

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

function renderComponent(
  widget: SimplifiedWidget<number>,
  modelValue: number | undefined,
  unifiedRows = false
) {
  return render(WidgetInputNumberInput, {
    global: {
      plugins: [i18n],
      provide: { [UnifiedWidgetRowsKey]: unifiedRows }
    },
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
  it('preserves the typed draft until Enter commits and formats it', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = renderComponent(
      createNumberInputWidget(37, 'int', { useGrouping: true }),
      37,
      true
    )
    await rerender({
      'onUpdate:modelValue': (value: number) => rerender({ modelValue: value })
    })
    const input = screen.getByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '123456789')

    expect(input).toHaveValue('123456789')
    expect(emitted()['update:modelValue']).toBeUndefined()

    await user.keyboard('{Enter}')

    expect(input).toHaveValue('123,456,789')
    expect(emitted()['update:modelValue']).toEqual([[123456789]])
  })

  it.for([
    { target: 'row', disabled: false, expected: 49 },
    { target: 'label', disabled: false, expected: 49 },
    { target: 'input', disabled: false, expected: 37 },
    { target: 'increment', disabled: false, expected: 39 },
    { target: 'row', disabled: true, expected: 37 }
  ] as const)(
    'handles a unified $target gesture with disabled=$disabled',
    async ({ target, disabled, expected }) => {
      const user = userEvent.setup()
      const { rerender } = renderComponent(
        createNumberInputWidget(37, 'int', { step2: 2, disabled }),
        37,
        true
      )
      await rerender({
        'onUpdate:modelValue': (value: number) =>
          rerender({ modelValue: value })
      })
      const targets = {
        row: screen.getByTestId('widget-number-row'),
        label: screen.getByText('test_input_number'),
        input: screen.getByRole('spinbutton'),
        increment: screen.getByTestId('increment')
      }

      await user.pointer([
        {
          keys: '[MouseLeft>]',
          target: targets[target],
          coords: { clientX: 20, clientY: 10 }
        },
        { target: targets[target], coords: { clientX: 80, clientY: 10 } },
        { keys: '[/MouseLeft]', target: targets[target] }
      ])

      expect(screen.getByRole('spinbutton')).toHaveValue(String(expected))
    }
  )

  it('keeps precision-limited steppers visible and disabled in unified rows', () => {
    renderComponent(
      createNumberInputWidget(18446744073709552000),
      18446744073709552000,
      true
    )

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
    expect(screen.getByRole('spinbutton')).toBeEnabled()
  })

  it('focuses the numeric input when its label is clicked', async () => {
    const user = userEvent.setup()
    renderComponent(createNumberInputWidget(37, 'int'), 37)

    await user.click(screen.getByText('test_input_number'))

    expect(screen.getByRole('spinbutton')).toHaveFocus()
  })

  it.for([
    { disabled: false, expected: 49 },
    { disabled: true, expected: 37 }
  ])(
    'scrubs the label with disabled=$disabled',
    async ({ disabled, expected }) => {
      const user = userEvent.setup()
      const widget = createNumberInputWidget(37, 'int', {
        step2: 2,
        disabled
      })
      const { rerender } = renderComponent(widget, 37)
      await rerender({
        'onUpdate:modelValue': (value: number) =>
          rerender({ modelValue: value })
      })
      const label = screen.getByText('test_input_number')

      await user.pointer([
        {
          keys: '[MouseLeft>]',
          target: label,
          coords: { clientX: 20, clientY: 10 }
        },
        { target: label, coords: { clientX: 80, clientY: 10 } },
        { keys: '[/MouseLeft]', target: label }
      ])

      expect(screen.getByRole('spinbutton')).toHaveValue(String(expected))
    }
  )

  it('displays initial value in input field', () => {
    const widget = createNumberInputWidget(42, 'int')
    renderComponent(widget, 42)

    expect(screen.getByLabelText('test_input_number')).toHaveValue('42')
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

  it('shows tooltip for disabled buttons due to precision limits', async () => {
    renderComponent(
      createNumberInputWidget(UNSAFE_LARGE_INTEGER, 'int'),
      UNSAFE_LARGE_INTEGER
    )

    await userEvent.hover(screen.getByRole('spinbutton'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /precision limit/i
    )
  })

  it('does not show tooltip for safe integer values', async () => {
    renderComponent(createNumberInputWidget(1000, 'int'), 1000)

    await userEvent.hover(screen.getByRole('spinbutton'))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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
    renderComponent(createNumberInputWidget(0, 'int'), undefined)

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('handles NaN values gracefully', () => {
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
