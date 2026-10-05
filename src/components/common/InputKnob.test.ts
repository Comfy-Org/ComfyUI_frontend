import { render, screen } from '@testing-library/vue'
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
})
