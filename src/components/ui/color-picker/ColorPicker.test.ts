import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ColorPicker from './ColorPicker.vue'

describe('ColorPicker', () => {
  it('gives the trigger button the provided accessible name', () => {
    render(ColorPicker, {
      props: { modelValue: '#ff0000', ariaLabel: 'Light color' }
    })

    expect(
      screen.getByRole('button', { name: 'Light color' })
    ).toBeInTheDocument()
  })
})
