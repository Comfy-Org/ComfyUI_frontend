import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

import CurveEditor from './CurveEditor.vue'

describe('CurveEditor', () => {
  it('renders SVG with curve path', () => {
    const wrapper = mount(CurveEditor, {
      props: {
        modelValue: [
          [0, 0],
          [1, 1]
        ] as CurvePoint[]
      }
    })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    const curvePath = wrapper.find('path[stroke-width="0.008"]')
    expect(curvePath.exists()).toBe(true)
    expect(curvePath.attributes('d')).toBeTruthy()
  })

  it('renders a circle for each control point', () => {
    const points: CurvePoint[] = [
      [0, 0],
      [0.5, 0.7],
      [1, 1]
    ]
    const wrapper = mount(CurveEditor, {
      props: { modelValue: points }
    })
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBe(3)
  })

  it('renders histogram path when provided', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++) histogram[i] = i + 1
    const wrapper = mount(CurveEditor, {
      props: {
        modelValue: [
          [0, 0],
          [1, 1]
        ] as CurvePoint[],
        histogram
      }
    })
    const histogramPath = wrapper.find('path[fill-opacity="0.15"]')
    expect(histogramPath.exists()).toBe(true)
    expect(histogramPath.attributes('d')).toContain('M0,1')
  })

  it('does not render histogram path when not provided', () => {
    const wrapper = mount(CurveEditor, {
      props: {
        modelValue: [
          [0, 0],
          [1, 1]
        ] as CurvePoint[]
      }
    })
    const histogramPath = wrapper.find('path[fill-opacity="0.15"]')
    expect(histogramPath.exists()).toBe(false)
  })
})
