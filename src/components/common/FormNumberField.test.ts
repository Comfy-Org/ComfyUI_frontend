import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import FormNumberField from './FormNumberField.vue'
import InputKnob from './InputKnob.vue'
import InputSlider from './InputSlider.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { increment: 'Increase', decrement: 'Decrease' } } }
})

describe('assembled number controls', () => {
  it.for([
    { name: 'slider', component: InputSlider },
    { name: 'knob', component: InputKnob }
  ])(
    '$name preserves fractional formatting and snaps typed values',
    async ({ component }) => {
      const user = userEvent.setup()
      const { emitted } = render(component, {
        props: {
          modelValue: 1.375,
          min: 0,
          max: 10,
          step: 0.125,
          ariaLabelledby: 'strength-label'
        },
        global: { plugins: [i18n] }
      })
      const label = document.createElement('span')
      label.id = 'strength-label'
      label.textContent = 'Strength'
      document.body.append(label)
      try {
        const input = screen.getByRole('spinbutton', { name: 'Strength' })
        expect(input).toHaveValue('1.375')
        await user.clear(input)
        await user.type(input, '1.18{Enter}')
        expect(emitted()['update:modelValue']).toContainEqual([1.125])
      } finally {
        label.remove()
      }
    }
  )

  it('keeps nullable settings values and translated stepping controls', async () => {
    const user = userEvent.setup()
    const { emitted } = render(FormNumberField, {
      props: { modelValue: null, min: 2, max: 8, step: 2, ariaLabel: 'Count' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('spinbutton', { name: 'Count' })).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(emitted()['update:modelValue']).toContainEqual([2])
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeVisible()
  })

  it('renders currency and percentage adornments without changing numeric input', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(FormNumberField, {
      props: {
        modelValue: 1234,
        min: 0,
        max: 2000,
        ariaLabel: 'Amount',
        formatOptions: { useGrouping: false, maximumFractionDigits: 0 }
      },
      slots: { prefix: '<span>$</span>', suffix: '<span>%</span>' },
      global: { plugins: [i18n] }
    })

    const input = screen.getByRole('spinbutton', { name: 'Amount' })
    expect(input).toHaveValue('1234')
    expect(screen.getByText('$')).toBeVisible()
    expect(screen.getByText('%')).toBeVisible()
    await user.clear(input)
    await user.type(input, '2500{Enter}')
    expect(emitted()['update:modelValue']).toContainEqual([2000])

    await rerender({ disabled: true })
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled()
  })
})
