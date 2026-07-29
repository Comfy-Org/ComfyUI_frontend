import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Switch from './Switch.vue'

describe('Switch', () => {
  it('exposes its state and requests the opposite value when clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Switch, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Notifications' }
    })

    const control = screen.getByRole('switch', { name: 'Notifications' })
    expect(control).not.toBeChecked()

    await user.click(control)

    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('prevents interaction while disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Switch, {
      props: {
        disabled: true,
        modelValue: true,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Notifications' }
    })

    const control = screen.getByRole('switch', { name: 'Notifications' })
    expect(control).toBeDisabled()

    await user.click(control)

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('keeps readonly switches focusable without changing their value', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Switch, {
      props: {
        modelValue: false,
        readonly: true,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Notifications' }
    })

    const control = screen.getByRole('switch', { name: 'Notifications' })
    expect(control).toHaveAttribute('aria-readonly', 'true')

    await user.tab()
    expect(control).toHaveFocus()

    await user.keyboard('[Space]')
    await user.keyboard('[Enter]')
    await user.click(control)

    expect(onUpdate).not.toHaveBeenCalled()
    expect(control).not.toBeChecked()
  })
})
