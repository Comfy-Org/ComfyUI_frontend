import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FormattedNumberStepper from './FormattedNumberStepper.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('FormattedNumberStepper', () => {
  it('commits negative decimal values with configured precision', async () => {
    const value = ref(0)
    render(FormattedNumberStepper, {
      props: {
        modelValue: value.value,
        min: -10,
        max: 10,
        step: 0.01,
        formatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        'onUpdate:modelValue': (nextValue: number) => {
          value.value = nextValue
        }
      },
      global: { plugins: [i18n] }
    })

    const input = screen.getByRole('spinbutton')
    await fireEvent.update(input, '-1.25')
    await fireEvent.blur(input)

    expect(value.value).toBe(-1.25)
    expect(input).toHaveValue('-1.25')
  })

  it('displays a suffix', () => {
    render(FormattedNumberStepper, {
      props: { modelValue: 5, suffix: '%' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('does not emit an invalid value when cleared', async () => {
    const user = userEvent.setup()
    const updates: number[] = []
    render(FormattedNumberStepper, {
      props: {
        modelValue: 5,
        min: 1,
        'onUpdate:modelValue': (value: number) => updates.push(value)
      },
      global: { plugins: [i18n] }
    })
    const input = screen.getByRole('spinbutton')

    await user.clear(input)
    expect(updates).toEqual([])
    expect(input).toHaveValue('')

    await user.tab()
    expect(updates).toEqual([])
    expect(input).toHaveValue('5')
  })

  it('does not round the model on focus and blur', async () => {
    const user = userEvent.setup()
    const updates: number[] = []
    render(FormattedNumberStepper, {
      props: {
        modelValue: 1.23456,
        formatOptions: { maximumFractionDigits: 3 },
        'onUpdate:modelValue': (value: number) => updates.push(value)
      },
      global: { plugins: [i18n] }
    })
    const input = screen.getByRole('spinbutton')

    await user.click(input)
    await user.tab()

    expect(input).toHaveValue('1.235')
    expect(updates).toEqual([])
  })

  it('steps with arrow keys and exposes spinbutton values', async () => {
    const user = userEvent.setup()
    const Harness = defineComponent({
      components: { FormattedNumberStepper },
      setup: () => ({ value: ref(2) }),
      template: '<FormattedNumberStepper v-model="value" :min="1" :max="3" />'
    })
    render(Harness, { global: { plugins: [i18n] } })
    const input = screen.getByRole('spinbutton')

    expect(input).toHaveAttribute('aria-valuenow', '2')
    expect(input).toHaveAttribute('aria-valuemin', '1')
    expect(input).toHaveAttribute('aria-valuemax', '3')

    await user.click(input)
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveAttribute('aria-valuenow', '3')
    expect(input).toHaveValue('3')

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-valuenow', '2')
    expect(input).toHaveValue('2')
  })
})
