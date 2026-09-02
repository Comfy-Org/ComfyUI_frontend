import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import DropdownControl from './DropdownControl.vue'

const renderComponent = (
  props: {
    label?: string
    options?: string[] | { label: string; value: string | number }[]
    modelValue?: string | number
  } = {},
  onUpdate?: (value: string | number) => void
) => {
  const user = userEvent.setup()
  const utils = render(DropdownControl, {
    props: {
      label: 'Mode',
      options: ['One', 'Two', 'Three'],
      modelValue: 'One',
      ...props,
      'onUpdate:modelValue': onUpdate
    }
  })
  return { user, ...utils }
}

describe('DropdownControl', () => {
  it('should render the label', () => {
    renderComponent({ label: 'Brush Mode' })
    expect(screen.getByText('Brush Mode')).toBeInTheDocument()
  })

  it('should expand string options to {label,value} pairs', () => {
    renderComponent({ options: ['Alpha', 'Beta'], modelValue: 'Alpha' })

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    const labels = Array.from(select.options).map((o) => o.textContent?.trim())

    expect(values).toEqual(['Alpha', 'Beta'])
    expect(labels).toEqual(['Alpha', 'Beta'])
  })

  it('should preserve {label,value} options as-is', () => {
    renderComponent({
      options: [
        { label: 'High', value: 1 },
        { label: 'Low', value: 2 }
      ],
      modelValue: 1
    })

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['1', '2'])
    expect(
      Array.from(select.options).map((o) => o.textContent?.trim())
    ).toEqual(['High', 'Low'])
  })

  it('should reflect modelValue as the selected option', () => {
    renderComponent({ options: ['One', 'Two'], modelValue: 'Two' })
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
      'Two'
    )
  })

  it('should emit update:modelValue with the chosen string value', async () => {
    const onUpdate = vi.fn()
    const { user } = renderComponent(
      { options: ['One', 'Two', 'Three'], modelValue: 'One' },
      onUpdate
    )

    await user.selectOptions(screen.getByRole('combobox'), 'Three')

    expect(onUpdate).toHaveBeenCalledWith('Three')
  })
})
