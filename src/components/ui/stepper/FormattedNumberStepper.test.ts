import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
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

    const input = screen.getByRole('textbox')
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
})
