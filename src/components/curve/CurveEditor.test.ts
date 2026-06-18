import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CurvePoint } from './types'

import CurveEditor from './CurveEditor.vue'

function renderEditor(points: CurvePoint[], extraProps = {}) {
  const { container } = render(CurveEditor, {
    props: { modelValue: points, ...extraProps }
  })
  return { container }
}

function getCurvePath() {
  return screen.getByTestId('curve-path')
}

describe('CurveEditor', () => {
  it('renders SVG with curve path', () => {
    const { container } = renderEditor([
      [0, 0],
      [1, 1]
    ])
    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelector('svg')).toBeInTheDocument()
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
    const curvePath = getCurvePath()
    expect(curvePath).toBeInTheDocument()
    expect(curvePath.getAttribute('d')).toBeTruthy()
  })

  it('renders a circle for each control point', () => {
    const { container } = renderEditor([
      [0, 0],
      [0.5, 0.7],
      [1, 1]
    ])
    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  })

  it('renders histogram path when provided', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++) histogram[i] = i + 1
    renderEditor(
      [
        [0, 0],
        [1, 1]
      ],
      { histogram }
    )
    const histogramPath = screen.getByTestId('histogram-path')
    expect(histogramPath).toBeInTheDocument()
    expect(histogramPath.getAttribute('d')).toContain('M0,1')
  })

  it('does not render histogram path when not provided', () => {
    renderEditor([
      [0, 0],
      [1, 1]
    ])
    expect(screen.queryByTestId('histogram-path')).not.toBeInTheDocument()
  })

  it('returns empty path with fewer than 2 points', () => {
    renderEditor([[0.5, 0.5]])
    expect(getCurvePath().getAttribute('d')).toBe('')
  })

  it('generates path starting with M and containing L segments', () => {
    renderEditor([
      [0, 0],
      [0.5, 0.8],
      [1, 1]
    ])
    const d = getCurvePath().getAttribute('d')!
    expect(d).toMatch(/^M/)
    expect(d).toContain('L')
  })

  it('curve path only spans the x-range of control points', () => {
    renderEditor([
      [0.2, 0.3],
      [0.8, 0.9]
    ])
    const d = getCurvePath().getAttribute('d')!
    const xValues = d
      .split(/[ML]/)
      .filter(Boolean)
      .map((s) => parseFloat(s.split(',')[0]))
    expect(Math.min(...xValues)).toBeCloseTo(0.2, 2)
    expect(Math.max(...xValues)).toBeCloseTo(0.8, 2)
  })

  it('deletes a point on right-click but keeps minimum 2', async () => {
    const points: CurvePoint[] = [
      [0, 0],
      [0.5, 0.5],
      [1, 1]
    ]
    const { container } = renderEditor(points)

    /* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/prefer-user-event */
    expect(container.querySelectorAll('circle')).toHaveLength(3)

    await fireEvent.pointerDown(container.querySelectorAll('circle')[1], {
      button: 2,
      pointerId: 1
    })
    expect(container.querySelectorAll('circle')).toHaveLength(2)

    await fireEvent.pointerDown(container.querySelectorAll('circle')[0], {
      button: 2,
      pointerId: 1
    })
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  })
})
