import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import en from '@/locales/en/main.json'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumberInput from './WidgetInputNumberInput.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en }
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
  modelValue: number | undefined
) {
  return render(WidgetInputNumberInput, {
    global: {
      plugins: [i18n]
    },
    props: {
      widget,
      modelValue
    }
  })
}

async function renderControlledComponent(
  widget: SimplifiedWidget<number>,
  modelValue: number
) {
  const result = renderComponent(widget, modelValue)
  await result.rerender({
    'onUpdate:modelValue': (value: number) =>
      result.rerender({ modelValue: value })
  })
  return result
}

function getNumberInput(container: Element) {
  return container.querySelector(
    'input[inputmode="decimal"]'
  ) as HTMLInputElement
}

describe('WidgetInputNumberInput Value Binding', () => {
  it('preserves the typed draft until Enter commits and formats it', async () => {
    const user = userEvent.setup()
    const { emitted } = await renderControlledComponent(
      createNumberInputWidget(37, 'int', { useGrouping: true }),
      37
    )
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
    { key: 'ArrowUp', expected: '124' },
    { key: 'ArrowDown', expected: '122' },
    { key: 'PageUp', expected: '133' },
    { key: 'PageDown', expected: '113' }
  ])('commits the draft before $key', async ({ key, expected }) => {
    const user = userEvent.setup()
    await renderControlledComponent(
      createNumberInputWidget(37, 'int', { step2: 1 }),
      37
    )
    const input = screen.getByRole('spinbutton')

    await user.clear(input)
    await user.type(input, `123{${key}}`)

    expect(input).toHaveValue(expected)
    expect(input).toHaveFocus()
  })

  it.for([
    {
      pointer: 'MouseLeft',
      pointerName: 'mouse',
      value: 37,
      draft: '1000',
      commitKey: '',
      expected: '1133'
    },
    {
      pointer: 'TouchA',
      pointerName: 'TouchA',
      value: 37,
      draft: '1000',
      commitKey: '',
      expected: '1133'
    },
    {
      pointer: 'TouchA',
      pointerName: 'TouchA',
      value: 37,
      draft: '1000',
      commitKey: '{Enter}',
      expected: '1133'
    },
    {
      pointer: 'TouchA',
      pointerName: 'TouchA',
      value: 37,
      draft: '18446744073709552000',
      commitKey: '',
      expected: '18446744073709552000'
    },
    {
      pointer: 'TouchA',
      pointerName: 'TouchA',
      value: 18446744073709552000,
      draft: '1000',
      commitKey: '',
      expected: '1133'
    }
  ])(
    'blocks $pointer scrubbing of "$draft" from $value until blur (key="$commitKey")',
    async ({ pointer, pointerName, value, draft, commitKey, expected }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(value, 'int', { step2: 1 }),
        value
      )
      const input = screen.getByRole('spinbutton')
      const row = screen.getByTestId('widget-number-row')
      const label = screen.getByText('test_input_number')
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 300, 24)
      )

      await user.clear(input)
      await user.type(input, `${draft}${commitKey}`)
      await user.pointer([
        {
          keys: `[${pointer}>]`,
          target: label,
          coords: { clientX: 20, clientY: 10 }
        },
        { pointerName, target: label, coords: { clientX: 30, clientY: 10 } }
      ])

      expect(input).toHaveValue(draft)

      await user.pointer([
        { pointerName, target: label, coords: { clientX: 40, clientY: 10 } },
        { keys: `[/${pointer}]`, target: label }
      ])

      expect(input).toHaveValue(draft)
      await user.tab()
      expect(input).toHaveValue(draft)
      expect(input).not.toHaveFocus()

      await user.pointer([
        {
          keys: `[${pointer}>]`,
          target: label,
          coords: { clientX: 20, clientY: 10 }
        },
        { pointerName, target: label, coords: { clientX: 30, clientY: 10 } },
        { pointerName, target: label, coords: { clientX: 40, clientY: 10 } },
        { keys: `[/${pointer}]`, target: label }
      ])

      expect(input).toHaveValue(expected)
      expect(input).toHaveAttribute('aria-valuenow', expected)
    }
  )

  it.for(['', '{Enter}'])(
    'Escape restores the value before focus after typing with %s',
    async (commitKey) => {
      const user = userEvent.setup()
      const { rerender } = await renderControlledComponent(
        createNumberInputWidget(37),
        37
      )
      await rerender({ modelValue: 83 })
      const input = screen.getByRole('spinbutton')

      await user.clear(input)
      await user.type(input, `1000${commitKey}{Escape}`)

      expect(input).toHaveValue('83')
      expect(input).toHaveAttribute('aria-valuenow', '83')
      expect(input).not.toHaveFocus()
    }
  )

  it.for([
    { target: 'row', disabled: false, expected: 157 },
    { target: 'label', disabled: false, expected: 157 },
    { target: 'input', disabled: false, expected: 37 },
    { target: 'increment', disabled: false, expected: 39 },
    { target: 'row', disabled: true, expected: 37 }
  ] as const)(
    'handles a unified $target gesture with disabled=$disabled',
    async ({ target, disabled, expected }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(37, 'int', { step2: 2, disabled }),
        37
      )
      const targets = {
        row: screen.getByTestId('widget-number-row'),
        label: screen.getByText('test_input_number'),
        input: screen.getByRole('spinbutton'),
        increment: screen.getByTestId('increment')
      }
      vi.spyOn(targets.row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 300, 24)
      )

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

  it.for([
    { clientX: 21, clientY: 14 },
    { clientX: 24, clientY: 22 }
  ])(
    'preserves the value during vertical touch scrolling to $clientX,$clientY',
    async ({ clientX, clientY }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(37, 'int', { step2: 2 }),
        37
      )
      const row = screen.getByTestId('widget-number-row')

      await user.pointer([
        {
          keys: '[TouchA>]',
          target: row,
          coords: { clientX: 20, clientY: 10 }
        },
        { pointerName: 'TouchA', target: row, coords: { clientX, clientY } }
      ])
      await fireEvent.pointerCancel(row, {
        pointerId: 2,
        pointerType: 'touch',
        buttons: 0
      })

      expect(screen.getByRole('spinbutton')).toHaveValue('37')
    }
  )

  it.for([
    {
      name: 'fragmented',
      start: 37,
      step: 2,
      width: 300,
      max: 5000,
      moves: [30, 40, 50, 80],
      expected: 157
    },
    {
      name: 'return to origin',
      start: 37,
      step: 2,
      width: 300,
      max: 5000,
      moves: [80, 20],
      expected: 37
    },
    {
      name: 'return after clamping',
      start: 37,
      step: 2,
      width: 300,
      max: 50,
      moves: [620, 20],
      expected: 37
    },
    {
      name: 'larger magnitude',
      start: 3700,
      step: 2,
      width: 300,
      max: 10000,
      moves: [80],
      expected: 5180
    },
    {
      name: 'scaled row',
      start: 3700,
      step: 2,
      width: 600,
      max: 10000,
      moves: [140],
      expected: 5180
    },
    {
      name: 'zero',
      start: 0,
      step: 2,
      width: 300,
      max: 5000,
      moves: [80],
      expected: 120
    },
    {
      name: 'fractional',
      start: -0.75,
      step: 0.05,
      width: 300,
      max: 5000,
      moves: [80],
      expected: 2.25
    },
    {
      name: 'precision boundary',
      start: 9007199254740990,
      step: 3,
      width: 300,
      max: Number.MAX_VALUE,
      moves: [80],
      expected: 9007199254740991
    },
    {
      name: 'unsafe starting value',
      start: 9007199254740992,
      step: 3,
      width: 300,
      max: Number.MAX_VALUE,
      moves: [10],
      expected: 9007199254740992
    }
  ])(
    'keeps scrubbing position-based for $name',
    async ({ start, step, width, max, moves, expected }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(start, 'float', {
          step2: step,
          max,
          precision: 2
        }),
        start
      )
      const row = screen.getByTestId('widget-number-row')
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, width, 24)
      )

      await user.pointer([
        {
          keys: '[MouseLeft>]',
          target: row,
          coords: { clientX: 20, clientY: 10 }
        },
        ...moves.map((clientX) => ({
          target: row,
          coords: { clientX, clientY: 10 }
        })),
        { keys: '[/MouseLeft]', target: row }
      ])

      expect(
        Number(screen.getByRole('spinbutton').getAttribute('aria-valuenow'))
      ).toBeCloseTo(expected, 12)
    }
  )

  it('focuses the numeric input when its label is clicked', async () => {
    const user = userEvent.setup()
    renderComponent(createNumberInputWidget(37, 'int'), 37)

    await user.click(screen.getByText('test_input_number'))

    expect(screen.getByRole('spinbutton')).toHaveFocus()
  })

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

  it.for([
    { start: 9007199254740990, key: 'ArrowUp', expected: '9007199254740991' },
    { start: 9007199254740991, key: 'ArrowUp', expected: '9007199254740991' },
    { start: 9007199254740991, key: 'ArrowDown', expected: '9007199254740990' },
    { start: -9007199254740991, key: 'PageUp', expected: '-9007199254740981' },
    {
      start: -9007199254740991,
      key: 'ArrowDown',
      expected: '-9007199254740991'
    },
    { start: 9007199254740988, key: 'PageUp', expected: '9007199254740991' },
    {
      start: -9007199254740988,
      key: 'PageDown',
      expected: '-9007199254740991'
    },
    { start: 9007199254740992, key: 'ArrowDown', expected: '9007199254740992' },
    { start: -9007199254740992, key: 'PageUp', expected: '-9007199254740992' },
    { start: 0.25, key: 'ArrowUp', expected: '1.25' }
  ])(
    'limits $key from $start to $expected',
    async ({ start, key, expected }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(start, 'float', { step2: 1 }),
        start
      )
      await user.click(screen.getByTestId('widget-number-row'))
      await user.keyboard(`{${key}}`)

      expect(screen.getByRole('spinbutton')).toHaveValue(expected)
    }
  )

  it.for([
    { start: 8, key: 'ArrowUp', expected: '9' },
    { start: 8, key: 'PageUp', expected: '9' },
    { start: -3, key: 'ArrowDown', expected: '-4' },
    { start: -3, key: 'PageDown', expected: '-4' }
  ])(
    'respects tighter bounds for $key from $start',
    async ({ start, key, expected }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(start, 'int', { min: -4, max: 9, step2: 3 }),
        start
      )
      await user.click(screen.getByTestId('widget-number-row'))
      await user.keyboard(`{${key}}`)

      expect(screen.getByRole('spinbutton')).toHaveValue(expected)
    }
  )

  it.for([
    {
      start: 9007199254740990,
      button: 'increment',
      expected: '9007199254740991',
      disabled: true
    },
    {
      start: -9007199254740990,
      button: 'decrement',
      expected: '-9007199254740991',
      disabled: true
    },
    {
      start: 9007199254740991,
      button: 'decrement',
      expected: '9007199254740988',
      disabled: false
    },
    {
      start: -9007199254740991,
      button: 'increment',
      expected: '-9007199254740988',
      disabled: false
    }
  ])(
    'steps $button from $start to $expected at the precision boundary',
    async ({ start, button, expected, disabled }) => {
      const user = userEvent.setup()
      await renderControlledComponent(
        createNumberInputWidget(start, 'int', { step2: 3 }),
        start
      )

      await user.click(screen.getByTestId(button))

      expect(screen.getByRole('spinbutton')).toHaveValue(expected)
      expect(screen.getByTestId(button)).toHaveProperty('disabled', disabled)
    }
  )

  it.for([
    { bounds: { max: -1e16 }, key: 'ArrowDown' },
    { bounds: { min: 1e16 }, key: 'ArrowUp' }
  ])(
    'blocks $key when updated bounds exclude the safe range',
    async ({ bounds, key }) => {
      const user = userEvent.setup()
      const { emitted, rerender } = await renderControlledComponent(
        createNumberInputWidget(37, 'int', { step2: 1 }),
        37
      )
      await rerender({
        widget: createNumberInputWidget(37, 'int', { ...bounds, step2: 1 })
      })

      await user.click(screen.getByTestId('widget-number-row'))
      await user.keyboard(`{${key}}`)

      expect(screen.getByRole('spinbutton')).toHaveValue('37')
      expect(emitted()['update:modelValue']).toBeUndefined()
      expect(screen.getByTestId('increment')).toBeDisabled()
      expect(screen.getByTestId('decrement')).toBeDisabled()
    }
  )

  it('commits unsafe text and allows editing back into the stepping range', async () => {
    const user = userEvent.setup()
    await renderControlledComponent(
      createNumberInputWidget(37, 'int', { step2: 1 }),
      37
    )
    const input = screen.getByRole('spinbutton')

    await user.clear(input)
    await user.type(input, '9007199254740992{ArrowDown}')
    expect(input).toHaveValue('9007199254740992')
    expect(screen.getByTestId('increment')).toBeDisabled()

    await user.clear(input)
    await user.type(input, '41{ArrowUp}')
    expect(input).toHaveValue('42')
  })

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

  it('disables unsafe stepping but keeps direct editing available', async () => {
    renderComponent(
      createNumberInputWidget(UNSAFE_LARGE_INTEGER, 'int'),
      UNSAFE_LARGE_INTEGER
    )

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
    expect(screen.getByRole('spinbutton')).toBeEnabled()

    await userEvent.click(screen.getByTestId('widget-number-row'))

    expect(screen.getByRole('spinbutton')).toHaveFocus()
  })

  it('disables buttons for unsafe negative integer values', () => {
    const unsafeNegative = -UNSAFE_LARGE_INTEGER
    renderComponent(
      createNumberInputWidget(unsafeNegative, 'int'),
      unsafeNegative
    )

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
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

  it('disables buttons for unsafe floating point values', () => {
    const unsafeFloat = UNSAFE_LARGE_INTEGER + 0.5
    renderComponent(createNumberInputWidget(unsafeFloat, 'float'), unsafeFloat)

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
  })
})

describe('WidgetInputNumberInput Edge Cases for Precision Handling', () => {
  it('handles null/undefined model values gracefully', () => {
    renderComponent(createNumberInputWidget(0, 'int'), undefined)

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('handles NaN values gracefully', () => {
    renderComponent(createNumberInputWidget(NaN, 'int'), NaN)

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
  })

  it('handles Infinity values', () => {
    renderComponent(createNumberInputWidget(Infinity, 'int'), Infinity)

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
  })

  it('handles negative Infinity values', () => {
    renderComponent(createNumberInputWidget(-Infinity, 'int'), -Infinity)

    expect(screen.getByTestId('increment')).toBeDisabled()
    expect(screen.getByTestId('decrement')).toBeDisabled()
  })
})
