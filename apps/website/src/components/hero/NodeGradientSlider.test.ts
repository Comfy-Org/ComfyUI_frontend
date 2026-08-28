// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import NodeGradientSlider from './NodeGradientSlider.vue'

const defaultProps = {
  label: 'HUE',
  min: 0,
  max: 360,
  step: 1,
  track: 'linear-gradient(red, blue)',
  valueText: '90 degrees',
  modelValue: 90
}

function renderSlider(props: Partial<typeof defaultProps> = {}) {
  const utils = render(NodeGradientSlider, {
    props: { ...defaultProps, ...props }
  })
  const slider = screen.getByRole('slider')
  vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 10,
    width: 100,
    height: 10,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
  const lastEmitted = () =>
    (utils.emitted('update:modelValue')?.at(-1) as [number] | undefined)?.[0]
  return { ...utils, slider, lastEmitted }
}

describe('NodeGradientSlider', () => {
  it('exposes its range through slider aria attributes', () => {
    const { slider } = renderSlider()

    expect(slider.getAttribute('aria-valuemin')).toBe('0')
    expect(slider.getAttribute('aria-valuemax')).toBe('360')
    expect(slider.getAttribute('aria-valuenow')).toBe('90')
    expect(slider.getAttribute('aria-valuetext')).toBe('90 degrees')
  })

  it('maps a pointer press to a quantized track position', () => {
    const { slider, lastEmitted } = renderSlider()

    slider.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 50 })
    )
    expect(lastEmitted()).toBe(180)

    slider.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 25, buttons: 1 })
    )
    expect(lastEmitted()).toBe(90)

    slider.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
  })

  it('ignores hover moves with no button held', () => {
    const { slider, lastEmitted } = renderSlider()

    slider.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 10, buttons: 0 })
    )
    expect(lastEmitted()).toBeUndefined()
  })

  it('clamps pointer positions past either end of the track', () => {
    const { slider, lastEmitted } = renderSlider()

    slider.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 500 })
    )
    expect(lastEmitted()).toBe(360)

    slider.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 2, clientX: -40 })
    )
    expect(lastEmitted()).toBe(0)
  })

  it('steps with arrow keys, five steps with shift, and clamps', () => {
    const { slider, lastEmitted } = renderSlider({
      min: 0,
      max: 2,
      step: 0.05,
      modelValue: 1.9
    })

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(lastEmitted()).toBeCloseTo(1.95)

    // 1.95 + 5 x 0.05 overshoots the max and clamps at 2.
    slider.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true })
    )
    expect(lastEmitted()).toBe(2)

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(lastEmitted()).toBeCloseTo(1.95)

    // Non-arrow keys leave the value alone.
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(lastEmitted()).toBeCloseTo(1.95)
  })
})
