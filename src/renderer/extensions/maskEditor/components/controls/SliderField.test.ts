import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import SliderField from './SliderField.vue'

vi.mock<unknown>(import('@/components/ui/slider/Slider.vue'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'min', 'max', 'step', 'disabled', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" :aria-labelledby="ariaLabelledby" :disabled="disabled" @click="$emit('update:modelValue', [7])">{{ modelValue?.[0] }}</button>`
  }
}))

const renderField = (onUpdate?: (value: number) => void) =>
  render(SliderField, {
    props: {
      label: 'Opacity',
      modelValue: 40,
      min: 0,
      max: 100,
      step: 1,
      suffix: '%',
      'onUpdate:modelValue': onUpdate
    }
  })

describe('SliderField', () => {
  it('should label the number input and the slider from the same text', () => {
    renderField()

    expect(screen.getByRole('spinbutton', { name: 'Opacity' })).toHaveValue(40)
    expect(screen.getByRole('button', { name: 'Opacity' })).toBeInTheDocument()
  })

  it('should emit a finite typed value', () => {
    const onUpdate = vi.fn()
    renderField(onUpdate)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Opacity'
    })

    input.value = '12'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onUpdate).toHaveBeenCalledWith(12)
  })

  it('should ignore a cleared field instead of writing 0', () => {
    const onUpdate = vi.fn()
    renderField(onUpdate)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Opacity'
    })

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('should clamp values past the max', () => {
    const onUpdate = vi.fn()
    renderField(onUpdate)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Opacity'
    })

    input.value = '400'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onUpdate).toHaveBeenCalledWith(100)
  })

  it('should emit the slider value', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    renderField(onUpdate)

    await user.click(screen.getByRole('button', { name: 'Opacity' }))

    expect(onUpdate).toHaveBeenCalledWith(7)
  })
})
