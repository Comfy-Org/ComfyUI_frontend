import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Checkbox from './Checkbox.vue'

describe('Checkbox', () => {
  it('exposes its state and requests the opposite value when activated', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Checkbox, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Show links' }
    })

    const control = screen.getByRole('checkbox', { name: 'Show links' })
    expect(control).not.toBeChecked()

    await user.tab()
    await user.keyboard('[Space]')

    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('prevents interaction while disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Checkbox, {
      props: {
        disabled: true,
        modelValue: true,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Show links' }
    })

    const control = screen.getByRole('checkbox', { name: 'Show links' })
    expect(control).toBeDisabled()

    await user.click(control)

    expect(onUpdate).not.toHaveBeenCalled()
  })
})
