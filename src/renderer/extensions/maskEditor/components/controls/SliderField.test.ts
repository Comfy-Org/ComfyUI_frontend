import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import SliderField from './SliderField.vue'

vi.mock<unknown>(import('@/components/ui/slider/Slider.vue'), () => ({
  default: {
    name: 'SliderStub',
    props: ['modelValue', 'min', 'max', 'step', 'disabled', 'ariaLabelledby'],
    emits: ['update:modelValue'],
    template: `<button data-slider="true" :aria-labelledby="ariaLabelledby" :disabled="disabled" :data-min="min" :data-max="max" :data-step="step" @click="$emit('update:modelValue', [7])">{{ modelValue?.[0] }}</button>`
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

  it('should resync the input to the model after a change commit', async () => {
    const onUpdate = vi.fn()
    renderField(onUpdate)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Opacity'
    })

    input.value = '400'
    input.dispatchEvent(new Event('change'))
    await nextTick()
    await nextTick()

    expect(onUpdate).toHaveBeenCalledWith(100)
    expect(input.value).toBe('40')
  })

  it('should reset a cleared input to the model on change', async () => {
    const onUpdate = vi.fn()
    renderField(onUpdate)
    const input = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Opacity'
    })

    input.value = ''
    input.dispatchEvent(new Event('change'))
    await nextTick()
    await nextTick()

    expect(onUpdate).not.toHaveBeenCalled()
    expect(input.value).toBe('40')
  })

  it('should emit the slider value', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    renderField(onUpdate)

    await user.click(screen.getByRole('button', { name: 'Opacity' }))

    expect(onUpdate).toHaveBeenCalledWith(7)
  })

  it('should pass the value range to the slider by default', () => {
    renderField()

    const slider = screen.getByRole('button', { name: 'Opacity' })

    expect(slider).toHaveAttribute('data-min', '0')
    expect(slider).toHaveAttribute('data-max', '100')
    expect(slider).toHaveAttribute('data-step', '1')
  })

  describe('slider position mode', () => {
    const renderThickness = (
      onSliderUpdate: (position: number) => void,
      onUpdate?: (value: number) => void
    ) =>
      render(SliderField, {
        props: {
          label: 'Thickness',
          modelValue: 16,
          min: 1,
          max: 250,
          step: 1,
          slider: { value: 0.5, min: 0, max: 1, step: 0.001 },
          onSliderUpdate,
          'onUpdate:modelValue': onUpdate
        }
      })

    it('should drive the slider from the position config', () => {
      renderThickness(vi.fn())

      const slider = screen.getByRole('button', { name: 'Thickness' })

      expect(slider).toHaveTextContent('0.5')
      expect(slider).toHaveAttribute('data-min', '0')
      expect(slider).toHaveAttribute('data-max', '1')
      expect(slider).toHaveAttribute('data-step', '0.001')
    })

    it('should emit the raw position instead of committing a value', async () => {
      const onSliderUpdate = vi.fn()
      const onUpdate = vi.fn()
      const user = userEvent.setup()
      renderThickness(onSliderUpdate, onUpdate)

      await user.click(screen.getByRole('button', { name: 'Thickness' }))

      expect(onSliderUpdate).toHaveBeenCalledWith(7)
      expect(onUpdate).not.toHaveBeenCalled()
    })
  })
})
