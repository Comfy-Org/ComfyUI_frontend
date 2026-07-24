import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ToggleControl from './ToggleControl.vue'

const renderComponent = (
  props: { label?: string; modelValue?: boolean } = {},
  onUpdate?: (value: boolean) => void
) => {
  const user = userEvent.setup()
  const utils = render(ToggleControl, {
    props: {
      label: 'Smoothing',
      modelValue: false,
      ...props,
      'onUpdate:modelValue': onUpdate
    }
  })
  return { user, ...utils }
}

describe('ToggleControl', () => {
  it('should render the label', () => {
    renderComponent({ label: 'Pressure Sensitivity' })
    expect(screen.getByText('Pressure Sensitivity')).toBeInTheDocument()
  })

  it('should reflect modelValue=false as unchecked', () => {
    renderComponent({ modelValue: false })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      false
    )
  })

  it('should reflect modelValue=true as checked', () => {
    renderComponent({ modelValue: true })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      true
    )
  })

  it('should emit update:modelValue=true when toggled on', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({ modelValue: false }, onUpdate)

    await user.click(screen.getByRole('checkbox'))

    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('should emit update:modelValue=false when toggled off', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent({ modelValue: true }, onUpdate)

    await user.click(screen.getByRole('checkbox'))

    expect(onUpdate).toHaveBeenCalledWith(false)
  })
})
