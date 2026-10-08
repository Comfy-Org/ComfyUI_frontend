import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import EditorSlider from './EditorSlider.vue'

function renderSlider(
  props: {
    min?: number
    max?: number
    step?: number
    unit?: string
    display?: string
    disabled?: boolean
  } = {}
) {
  const value = ref(40)
  render({
    setup: () => () =>
      h(EditorSlider, {
        ...props,
        label: 'Intensity',
        modelValue: value.value,
        'onUpdate:modelValue': (next: number) => {
          value.value = next
        }
      })
  })
  return { value, slider: screen.getByRole('slider', { name: 'Intensity' }) }
}

describe('EditorSlider', () => {
  it.for([
    { props: {}, shown: '40' },
    { props: { unit: '%' }, shown: '40%' },
    { props: { unit: '°', display: '0.40' }, shown: '0.40' }
  ])('shows $shown beside its label', ({ props, shown }) => {
    const { slider } = renderSlider(props)

    expect(slider).toHaveAttribute('aria-valuetext', shown)
    expect(screen.getByText(shown)).toBeVisible()
  })

  it('reports a dragged value as a number within its range', async () => {
    const { value, slider } = renderSlider({ min: -90, max: 90, step: 5 })
    expect(slider).toHaveAttribute('min', '-90')
    expect(slider).toHaveAttribute('max', '90')
    expect(slider).toHaveAttribute('step', '5')

    await fireEvent.update(slider, '-45')

    expect(value.value).toBe(-45)
    expect(screen.getByText('-45')).toBeVisible()
  })

  it('locks while disabled', () => {
    const { slider } = renderSlider({ disabled: true })

    expect(slider).toBeDisabled()
  })
})
