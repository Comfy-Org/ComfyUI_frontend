import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        decrement: 'Decrement',
        increment: 'Increment'
      }
    }
  }
})

async function flush() {
  await nextTick()
  await nextTick()
}

function renderStepper(
  props?: Partial<{
    modelValue: number
    min: number
    max: number
    step: number | ((value: number) => number)
    formatOptions: Intl.NumberFormatOptions
    disabled: boolean
    'onUpdate:modelValue': (value: number) => void
    onMaxReached: () => void
  }>
) {
  const user = userEvent.setup()
  const result = render(FormattedNumberStepper, {
    props: { modelValue: 0, ...props },
    global: { plugins: [i18n] }
  })
  return { user, ...result }
}

describe('FormattedNumberStepper', () => {
  describe('rendering', () => {
    it('renders increment and decrement buttons', () => {
      renderStepper()
      expect(
        screen.getByRole('button', { name: 'Decrement' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Increment' })
      ).toBeInTheDocument()
    })

    it('renders formatted initial value', () => {
      renderStepper({ modelValue: 1000 })
      expect(screen.getByRole('textbox')).toHaveValue('1,000')
    })

    it('renders prefix slot content', () => {
      render(FormattedNumberStepper, {
        props: { modelValue: 0 },
        slots: { prefix: '<span data-testid="prefix">$</span>' },
        global: { plugins: [i18n] }
      })
      expect(screen.getByTestId('prefix')).toBeInTheDocument()
    })

    it('renders suffix slot content', () => {
      render(FormattedNumberStepper, {
        props: { modelValue: 0 },
        slots: { suffix: '<span data-testid="suffix">USD</span>' },
        global: { plugins: [i18n] }
      })
      expect(screen.getByTestId('suffix')).toBeInTheDocument()
    })

    it('applies disabled state to input and buttons', () => {
      renderStepper({ disabled: true })
      expect(screen.getByRole('textbox')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled()
    })
  })

  describe('handleStep', () => {
    it('clicking + increments by step amount', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 1,
        step: 2,
        'onUpdate:modelValue': onUpdate
      })

      await user.click(screen.getByRole('button', { name: 'Increment' }))

      expect(onUpdate).toHaveBeenCalledWith(3)
      expect(screen.getByRole('textbox')).toHaveValue('3')
    })

    it('clicking − decrements by step amount', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 10,
        min: 0,
        step: 2,
        'onUpdate:modelValue': onUpdate
      })

      await user.click(screen.getByRole('button', { name: 'Decrement' }))

      expect(onUpdate).toHaveBeenCalledWith(8)
      expect(screen.getByRole('textbox')).toHaveValue('8')
    })

    it('disables − button at min', () => {
      renderStepper({ modelValue: 0, min: 0 })
      expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled()
    })

    it('disables + button at max', () => {
      renderStepper({ modelValue: 10, max: 10 })
      expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled()
    })

    it('clamps value to [min, max] range', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 9,
        min: 0,
        max: 10,
        step: 5,
        'onUpdate:modelValue': onUpdate
      })

      await user.click(screen.getByRole('button', { name: 'Increment' }))

      expect(onUpdate).toHaveBeenCalledWith(10)
      expect(screen.getByRole('textbox')).toHaveValue('10')
    })

    it('calls function-based step prop with current value', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const stepFn = vi.fn((value: number) => value + 1)
      const { user } = renderStepper({
        modelValue: 4,
        step: stepFn,
        'onUpdate:modelValue': onUpdate
      })

      await user.click(screen.getByRole('button', { name: 'Increment' }))

      expect(stepFn).toHaveBeenCalledWith(4)
      expect(onUpdate).toHaveBeenCalledWith(9)
    })
  })

  describe('handleInputChange', () => {
    it('typing digits updates modelValue', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 0,
        'onUpdate:modelValue': onUpdate
      })
      const input = screen.getByRole('textbox')

      await user.clear(input)
      await user.type(input, '1234')

      expect(onUpdate).toHaveBeenLastCalledWith(1234)
    })

    it('strips non-numeric characters', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 0,
        'onUpdate:modelValue': onUpdate
      })
      const input = screen.getByRole('textbox')

      await user.clear(input)
      await user.type(input, 'a1b2c3')

      expect(onUpdate).toHaveBeenLastCalledWith(123)
      expect(input).toHaveValue('123')
    })

    it('formats input with grouping separators', async () => {
      const { user } = renderStepper({ modelValue: 0 })
      const input = screen.getByRole('textbox')

      await user.clear(input)
      await user.type(input, '1000')

      expect(input).toHaveValue('1,000')
    })

    it('emits max-reached when input exceeds max', async () => {
      const onMaxReached = vi.fn()
      const { user } = renderStepper({
        modelValue: 0,
        max: 500,
        onMaxReached
      })
      const input = screen.getByRole('textbox')

      await user.clear(input)
      await user.type(input, '999')

      expect(onMaxReached).toHaveBeenCalled()
    })

    it('clamps to max when input exceeds max', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 0,
        max: 500,
        'onUpdate:modelValue': onUpdate
      })
      const input = screen.getByRole('textbox')

      await user.clear(input)
      await user.type(input, '999')

      expect(onUpdate).toHaveBeenLastCalledWith(500)
      expect(input).toHaveValue('500')
    })

    it('resolves empty input to 0', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 123,
        'onUpdate:modelValue': onUpdate
      })
      const input = screen.getByRole('textbox')

      await user.clear(input)

      expect(onUpdate).toHaveBeenLastCalledWith(0)
      expect(input).toHaveValue('0')
    })
  })

  describe('handleInputBlur', () => {
    it('clamps value below min to min on blur', async () => {
      const onUpdate = vi.fn<(value: number) => void>()
      const { user } = renderStepper({
        modelValue: 5,
        min: 10,
        'onUpdate:modelValue': onUpdate
      })
      const input = screen.getByRole('textbox')

      await user.click(input)
      await user.tab()

      expect(onUpdate).toHaveBeenLastCalledWith(10)
      expect(input).toHaveValue('10')
    })

    it('reformats display on blur', async () => {
      const { user } = renderStepper({ modelValue: 1000 })
      const input = screen.getByRole('textbox')

      await user.click(input)
      await user.tab()

      expect(input).toHaveValue('1,000')
    })
  })

  describe('handleInputFocus', () => {
    it('moves cursor to end of input on focus', async () => {
      const { user } = renderStepper({ modelValue: 1000 })
      const input = screen.getByRole('textbox') as HTMLInputElement

      input.setSelectionRange(0, 0)
      await user.click(input)
      await flush()

      expect(input.selectionStart).toBe(input.value.length)
      expect(input.selectionEnd).toBe(input.value.length)
    })
  })

  describe('v-model reactivity', () => {
    it('external modelValue change updates displayed text', async () => {
      const { rerender } = renderStepper({ modelValue: 1000 })
      expect(screen.getByRole('textbox')).toHaveValue('1,000')

      await rerender({ modelValue: 2500 })
      await flush()

      expect(screen.getByRole('textbox')).toHaveValue('2,500')
    })

    it('external modelValue change does not overwrite while focused', async () => {
      const { user, rerender } = renderStepper({ modelValue: 1000 })
      const input = screen.getByRole('textbox')

      await user.click(input)
      await user.clear(input)
      await user.type(input, '2')
      await rerender({ modelValue: 9000 })
      await flush()

      expect(input).toHaveValue('2')
    })
  })

  describe('formatNumber', () => {
    it('respects formatOptions prop', () => {
      renderStepper({
        modelValue: 1000,
        formatOptions: {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }
      })

      expect(screen.getByRole('textbox')).toHaveValue('$1,000')
    })

    it('applies locale formatting with default options', () => {
      renderStepper({ modelValue: 1234567 })
      expect(screen.getByRole('textbox')).toHaveValue('1,234,567')
    })
  })
})
