import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import RangeEditor from './RangeEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function mountEditor(props: InstanceType<typeof RangeEditor>['$props']) {
  return mount(RangeEditor, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('RangeEditor', () => {
  it('renders with min and max handles', () => {
    const wrapper = mountEditor({ modelValue: { min: 0.2, max: 0.8 } })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('[data-testid="handle-min"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="handle-max"]').exists()).toBe(true)
  })

  it('highlights selected range in plain mode', () => {
    const wrapper = mountEditor({ modelValue: { min: 0.2, max: 0.8 } })

    const highlight = wrapper.find('[data-testid="range-highlight"]')
    expect(highlight.attributes('x')).toBe('0.2')
    expect(
      Number.parseFloat(highlight.attributes('width') ?? 'NaN')
    ).toBeCloseTo(0.6, 6)
  })

  it('dims area outside the range in histogram mode', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++)
      histogram[i] = Math.floor(50 + 50 * Math.sin(i / 20))

    const wrapper = mountEditor({
      modelValue: { min: 0.2, max: 0.8 },
      display: 'histogram',
      histogram
    })

    const left = wrapper.find('[data-testid="range-dim-left"]')
    const right = wrapper.find('[data-testid="range-dim-right"]')
    expect(left.attributes('width')).toBe('0.2')
    expect(right.attributes('x')).toBe('0.8')
  })

  it('hides midpoint handle by default', () => {
    const wrapper = mountEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 }
    })

    expect(wrapper.find('[data-testid="handle-midpoint"]').exists()).toBe(false)
  })

  it('shows midpoint handle when showMidpoint is true', () => {
    const wrapper = mountEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 },
      showMidpoint: true
    })

    expect(wrapper.find('[data-testid="handle-midpoint"]').exists()).toBe(true)
  })

  it('renders gradient background when display is gradient', () => {
    const wrapper = mountEditor({
      modelValue: { min: 0, max: 1 },
      display: 'gradient',
      gradientStops: [
        { offset: 0, color: [0, 0, 0] as const },
        { offset: 1, color: [255, 255, 255] as const }
      ]
    })

    expect(wrapper.find('[data-testid="gradient-bg"]').exists()).toBe(true)
    expect(wrapper.find('linearGradient').exists()).toBe(true)
  })

  it('renders histogram path when display is histogram with data', () => {
    const histogram = new Uint32Array(256)
    for (let i = 0; i < 256; i++)
      histogram[i] = Math.floor(50 + 50 * Math.sin(i / 20))

    const wrapper = mountEditor({
      modelValue: { min: 0, max: 1 },
      display: 'histogram',
      histogram
    })

    expect(wrapper.find('[data-testid="histogram-path"]').exists()).toBe(true)
  })

  it('renders inputs for min and max', () => {
    const wrapper = mountEditor({ modelValue: { min: 0.2, max: 0.8 } })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(2)
  })

  it('renders midpoint input when showMidpoint is true', () => {
    const wrapper = mountEditor({
      modelValue: { min: 0, max: 1, midpoint: 0.5 },
      showMidpoint: true
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(3)
  })

  it('normalizes handle positions with custom value range', () => {
    const wrapper = mountEditor({
      modelValue: { min: 64, max: 192 },
      valueMin: 0,
      valueMax: 255
    })

    const minHandle = wrapper.find('[data-testid="handle-min"]')
    const maxHandle = wrapper.find('[data-testid="handle-max"]')

    expect(
      Number.parseFloat((minHandle.element as HTMLElement).style.left)
    ).toBeCloseTo(25, 0)
    expect(
      Number.parseFloat((maxHandle.element as HTMLElement).style.left)
    ).toBeCloseTo(75, 0)
  })
})
