import { describe, expect, it } from 'vitest'

import { render, screen } from '@testing-library/vue'

import type { ColorStop } from '@/lib/litegraph/src/interfaces'

import GradientSlider from './GradientSlider.vue'
import { interpolateStops, stopsToGradient } from './gradients'

const TEST_STOPS: ColorStop[] = [
  { offset: 0, color: [0, 0, 0] },
  { offset: 1, color: [255, 255, 255] }
]

function renderSlider(props: {
  stops?: ColorStop[]
  modelValue: number
  min?: number
  max?: number
  step?: number
}) {
  return render(GradientSlider, {
    props: { stops: TEST_STOPS, ...props }
  })
}

describe('GradientSlider', () => {
  it('passes min and max to SliderRoot', () => {
    renderSlider({
      modelValue: 50,
      min: -100,
      max: 100,
      step: 5
    })
    const thumb = screen.getByRole('slider', { hidden: true })
    expect(thumb).toBeInTheDocument()
    expect(thumb).toHaveAttribute('aria-valuemin', '-100')
    expect(thumb).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders slider root with track and thumb', () => {
    const { container } = renderSlider({ modelValue: 0 })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('[data-slider-impl]')).toBeInTheDocument()
    expect(screen.getByRole('slider', { hidden: true })).toBeInTheDocument()
  })

  it('does not render SliderRange', () => {
    const { container } = renderSlider({ modelValue: 50 })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const range = container.querySelector('[data-slot="slider-range"]')
    expect(range).not.toBeInTheDocument()
  })
})

describe('stopsToGradient', () => {
  it('returns transparent for empty stops', () => {
    expect(stopsToGradient([])).toBe('transparent')
  })
})

describe('interpolateStops', () => {
  it('returns transparent for empty stops', () => {
    expect(interpolateStops([], 0.5)).toBe('transparent')
  })

  it('returns start color at t=0', () => {
    expect(interpolateStops(TEST_STOPS, 0)).toBe('rgb(0,0,0)')
  })

  it('returns end color at t=1', () => {
    expect(interpolateStops(TEST_STOPS, 1)).toBe('rgb(255,255,255)')
  })

  it('returns midpoint color at t=0.5', () => {
    expect(interpolateStops(TEST_STOPS, 0.5)).toBe('rgb(128,128,128)')
  })

  it('clamps values below 0', () => {
    expect(interpolateStops(TEST_STOPS, -1)).toBe('rgb(0,0,0)')
  })

  it('clamps values above 1', () => {
    expect(interpolateStops(TEST_STOPS, 2)).toBe('rgb(255,255,255)')
  })
})
