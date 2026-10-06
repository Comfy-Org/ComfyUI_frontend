import { render, screen } from '@testing-library/vue'
import { Chart } from 'chart.js'
import type { ChartData } from 'chart.js'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import type { ChartWidgetOptions } from './WidgetChart.types'
import WidgetChart from './WidgetChart.vue'
import { createMockWidget } from './widgetTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { chart: 'Chart', chartLowercase: 'chart' } } }
})

function makeWidget(
  options: Partial<ChartWidgetOptions> = {}
): SimplifiedWidget<ChartData, ChartWidgetOptions> {
  return createMockWidget<ChartData>({
    value: { labels: [], datasets: [] },
    name: 'test_chart',
    type: 'chart',
    options: options
  })
}

function renderChart(
  widget: SimplifiedWidget<ChartData, ChartWidgetOptions>,
  modelValue: ChartData | null
) {
  const value = ref<ChartData | null>(modelValue)
  const Harness = defineComponent({
    components: { WidgetChart },
    setup: () => ({ widget, value }),
    template: '<WidgetChart :widget="widget" v-model="value" />'
  })
  render(Harness, { global: { plugins: [i18n] } })
  return { value }
}

function getChart(name: string) {
  const canvas = screen.getByRole('img', { name })
  assert(canvas instanceof HTMLCanvasElement)
  return Chart.getChart(canvas)
}

describe('WidgetChart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement, _contextId: string) {
        return createMockCanvasRenderingContext2D({ canvas: this })
      } as HTMLCanvasElement['getContext']
    )
  })

  it.for<{ options: Partial<ChartWidgetOptions>; type: string }>([
    { options: {}, type: 'line' },
    { options: { type: 'bar' }, type: 'bar' }
  ])('renders a $type chart for options $options', ({ options, type }) => {
    renderChart(makeWidget(options), { labels: [], datasets: [] })

    expect(getChart(`test_chart - ${type} chart`)?.config).toMatchObject({
      type
    })
  })

  it('uses the translated "Chart" label when the widget has no name', () => {
    const widget = makeWidget()
    widget.name = ''
    renderChart(widget, { labels: [], datasets: [] })

    expect(
      screen.getByRole('img', { name: 'Chart - line chart' })
    ).toBeVisible()
  })

  it('passes the model value to the chart', () => {
    renderChart(makeWidget(), {
      labels: ['a', 'b'],
      datasets: [{ label: 'x', data: [1, 2] }]
    })

    const chartData = getChart('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual(['a', 'b'])
    expect(chartData?.datasets[0].label).toBe('x')
  })

  it('falls back to empty labels and datasets when the value becomes null', async () => {
    const { value } = renderChart(makeWidget(), {
      labels: ['a'],
      datasets: [{ label: 'x', data: [1] }]
    })

    value.value = null
    await nextTick()

    const chartData = getChart('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual([])
    expect(chartData?.datasets).toEqual([])
  })

  it('updates the chart when the model value changes', async () => {
    const { value } = renderChart(makeWidget(), {
      labels: ['a'],
      datasets: [{ label: 'x', data: [1] }]
    })

    value.value = {
      labels: ['b', 'c'],
      datasets: [{ label: 'y', data: [2, 3] }]
    }
    await nextTick()

    const chartData = getChart('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual(['b', 'c'])
    expect(chartData?.datasets[0].label).toBe('y')
  })
})
