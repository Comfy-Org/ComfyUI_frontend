import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

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

  it.for([
    ['Ctrl', '{Control>}{Enter}{/Control}'],
    ['Meta', '{Meta>}{Enter}{/Meta}']
  ])('ignores Enter while %s is held', async ([, keystrokes]) => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Switch, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Notifications' }
    })

    const keysSeenByWindow: string[] = []
    const recordKeydown = (event: KeyboardEvent) =>
      keysSeenByWindow.push(event.key)
    window.addEventListener('keydown', recordKeydown)
    onTestFinished(() => {
      window.removeEventListener('keydown', recordKeydown)
    })

    const control = screen.getByRole('switch', { name: 'Notifications' })
    await user.tab()
    expect(control).toHaveFocus()

    await user.keyboard(keystrokes)
    expect(onUpdate).not.toHaveBeenCalled()
    expect(keysSeenByWindow).toContain('Enter')

    await user.keyboard('[Enter]')
    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('stays interactive after a modified Enter is ignored', async () => {
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
    await user.tab()
    await user.keyboard('{Control>}{Enter}{/Control}')
    await user.click(control)

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(true)
  })
})
