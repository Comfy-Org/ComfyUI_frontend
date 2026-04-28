import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import RangeEditor from './RangeEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function renderEditor(props: {
  modelValue: { min: number; max: number; midpoint?: number }
  [key: string]: unknown
}) {
  return render(RangeEditor, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('RangeEditor', () => {
  it('renders with min and max handles', () => {
    renderEditor({ modelValue: { min: 0.2, max: 0.8 } })

    expect(screen.getByTestId('handle-min')).toBeDefined()
    expect(screen.getByTestId('handle-max')).toBeDefined()
  })

  it('highlights selected range in plain mode', () => {
    renderEditor({ modelValue: { min: 0.2, max: 0.8 } })

    const highlight = screen.getByTestId('range-highlight')
    expect(highlight.getAttribute('x')).toBe('0.2')
    expect(
      Number.parseFloat(highlight.getAttribute('width') ?? 'NaN')
    ).toBeCloseTo(0.6, 6)
  })

  it('dims area outside the range in histogram mode', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++)
      histogram[i] = Math.floor(50 + 50 * Math.sin(i / 20))

    renderEditor({
      modelValue: { min: 0.2, max: 0.8 },
      display: 'histogram',
      histogram
    })

    const left = screen.getByTestId('range-dim-left')
    const right = screen.getByTestId('range-dim-right')
    expect(left.getAttribute('width')).toBe('0.2')
    expect(right.getAttribute('x')).toBe('0.8')
  })

  it('hides midpoint handle by default', () => {
    renderEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 }
    })

    expect(screen.queryByTestId('handle-midpoint')).toBeNull()
  })

  it('shows midpoint handle when showMidpoint is true', () => {
    renderEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 },
      showMidpoint: true
    })

    expect(screen.getByTestId('handle-midpoint')).toBeDefined()
  })

  it('renders gradient background when display is gradient', () => {
    renderEditor({
      modelValue: { min: 0, max: 1 },
      display: 'gradient',
      gradientStops: [
        { offset: 0, color: [0, 0, 0] as const },
        { offset: 1, color: [255, 255, 255] as const }
      ]
    })

    expect(screen.getByTestId('gradient-bg')).toBeDefined()
    expect(screen.getByTestId('gradient-def')).toBeDefined()
  })

  it('renders histogram path when display is histogram with data', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++)
      histogram[i] = Math.floor(50 + 50 * Math.sin(i / 20))

    renderEditor({
      modelValue: { min: 0, max: 1 },
      display: 'histogram',
      histogram
    })

    expect(screen.getByTestId('histogram-path')).toBeDefined()
  })

  it('renders inputs for min and max', () => {
    renderEditor({ modelValue: { min: 0.2, max: 0.8 } })

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(2)
  })

  it('renders midpoint input when showMidpoint is true', () => {
    renderEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 },
      showMidpoint: true
    })

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(3)
  })

  it('normalizes handle positions with custom value range', () => {
    renderEditor({
      modelValue: { min: 64, max: 192 },
      valueMin: 0,
      valueMax: 255
    })

    const minHandle = screen.getByTestId('handle-min')
    const maxHandle = screen.getByTestId('handle-max')

    expect(Number.parseFloat(minHandle.style.left)).toBeCloseTo(25, 0)
    expect(Number.parseFloat(maxHandle.style.left)).toBeCloseTo(75, 0)
  })
})
