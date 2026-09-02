import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import SliderControl from './SliderControl.vue'

const renderComponent = (
  props: {
    label?: string
    min?: number
    max?: number
    step?: number
    modelValue?: number
  } = {},
  onUpdate?: (value: number) => void
) => {
  return render(SliderControl, {
    props: {
      label: 'Brush Size',
      min: 1,
      max: 100,
      modelValue: 10,
      ...props,
      'onUpdate:modelValue': onUpdate
    }
  })
}

const setSliderValue = (input: HTMLInputElement, value: string): void => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('SliderControl', () => {
  it('should render the label', () => {
    renderComponent({ label: 'Hardness' })
    expect(screen.getByText('Hardness')).toBeInTheDocument()
  })

  it('should expose min, max, step and modelValue on the input', () => {
    renderComponent({ min: 0, max: 50, step: 5, modelValue: 25 })

    const input = screen.getByRole('slider') as HTMLInputElement
    expect(input.min).toBe('0')
    expect(input.max).toBe('50')
    expect(input.step).toBe('5')
    expect(input.value).toBe('25')
  })

  it('should default step to 1 when not provided', () => {
    renderComponent({ min: 0, max: 10, modelValue: 5 })

    expect((screen.getByRole('slider') as HTMLInputElement).step).toBe('1')
  })

  it('should emit update:modelValue with a number when input changes', () => {
    const onUpdate = vi.fn()
    renderComponent({ min: 1, max: 100, modelValue: 10 }, onUpdate)

    setSliderValue(screen.getByRole('slider') as HTMLInputElement, '42')

    expect(onUpdate).toHaveBeenLastCalledWith(42)
    expect(typeof onUpdate.mock.calls.at(-1)![0]).toBe('number')
  })
})
