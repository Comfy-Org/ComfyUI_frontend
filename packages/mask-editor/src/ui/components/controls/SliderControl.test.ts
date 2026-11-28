import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'

import SliderControl from './SliderControl.vue'

const renderComponent = (
  props: {
    label?: string
    min?: number
    max?: number
    step?: number
    modelValue?: number
    showInput?: boolean
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

    expect(screen.getByRole<HTMLInputElement>('slider').step).toBe('1')
  })

  it('should emit update:modelValue with a number when input changes', () => {
    const onUpdate = vi.fn()
    renderComponent({ min: 1, max: 100, modelValue: 10 }, onUpdate)

    setSliderValue(screen.getByRole('slider') as HTMLInputElement, '42')

    expect(onUpdate).toHaveBeenLastCalledWith(42)
    expect(typeof onUpdate.mock.calls.at(-1)![0]).toBe('number')
  })

  describe('number box', () => {
    it('should not show a number box unless asked to', () => {
      renderComponent()

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('should show the current value in a number box named after the label', () => {
      renderComponent({ label: 'Tolerance', modelValue: 25, showInput: true })

      expect(
        screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Tolerance' })
          .value
      ).toBe('25')
    })

    it('should emit the typed value as a number', async () => {
      const onUpdate = vi.fn()
      renderComponent({ showInput: true }, onUpdate)
      const user = userEvent.setup()

      await user.clear(screen.getByRole('spinbutton'))
      await user.type(screen.getByRole('spinbutton'), '42')

      expect(onUpdate).toHaveBeenLastCalledWith(42)
    })

    it('should not emit while the number box is empty', async () => {
      const onUpdate = vi.fn()
      renderComponent({ showInput: true }, onUpdate)
      const user = userEvent.setup()

      await user.clear(screen.getByRole('spinbutton'))

      expect(onUpdate).not.toHaveBeenCalled()
    })

    it.for([
      { from: 'below the max', start: 50, keys: '{Control>}a{/Control}999' },
      { from: 'at the max', start: 100, keys: '0' }
    ])(
      'should clamp a value typed from $from and show the clamped value once committed',
      async ({ start, keys }) => {
        const model = ref(start)
        render(() =>
          h(SliderControl, {
            label: 'Tolerance',
            min: 0,
            max: 100,
            showInput: true,
            modelValue: model.value,
            'onUpdate:modelValue': (value: number) => {
              model.value = value
            }
          })
        )
        const user = userEvent.setup()

        await user.type(screen.getByRole('spinbutton'), keys)
        await user.tab()

        expect(model.value).toBe(100)
        expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe(
          '100'
        )
      }
    )
  })
})
