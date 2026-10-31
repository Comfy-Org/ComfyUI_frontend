import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import InputKnob from './InputKnob.vue'

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

describe('InputKnob', () => {
  it('disables both the knob and the number field', () => {
    render(InputKnob, {
      props: { modelValue: 5, disabled: true, ariaLabel: 'Strength' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('slider', { name: 'Strength' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByRole('spinbutton', { name: 'Strength' })).toBeDisabled()
  })

  it('commits a typed value unsnapped when step is 0', async () => {
    const user = userEvent.setup()
    const { emitted } = render(InputKnob, {
      props: { modelValue: 5, min: 0, max: 10, step: 0, ariaLabel: 'Strength' },
      global: { plugins: [i18n] }
    })
    const field = screen.getByRole('spinbutton', { name: 'Strength' })

    await user.clear(field)
    await user.type(field, '7.25{Enter}')

    expect(emitted()['update:modelValue']).toContainEqual([7.25])
  })
})
