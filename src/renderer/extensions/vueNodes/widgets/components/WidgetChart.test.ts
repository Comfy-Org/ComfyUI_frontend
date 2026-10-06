import { render, screen } from '@testing-library/vue'
import type { ChartData } from 'chart.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { getChartByName } from '@/components/ui/chart/__tests__/chartTestUtils'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import type { ChartWidgetOptions } from './WidgetChart.types'
import WidgetChart from './WidgetChart.vue'
import { createMockWidget } from './widgetTestUtils'

type ChartValue = Partial<ChartData> | null

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { chart: 'Chart', chartLowercase: 'chart' } } }
})

function makeWidget(
  options: Partial<ChartWidgetOptions> = {}
): SimplifiedWidget<ChartValue, ChartWidgetOptions> {
  return createMockWidget<ChartValue>({
    value: { labels: [], datasets: [] },
    name: 'test_chart',
    type: 'chart',
    options
  })
}

function renderChart(
  widget: SimplifiedWidget<ChartValue, ChartWidgetOptions>,
  modelValue: ChartValue
) {
  return render(WidgetChart, {
    props: { widget, modelValue },
    global: { plugins: [i18n] }
  })
}

describe('WidgetChart', () => {
  beforeEach(stubCanvasGetContext)

  it.for<{ options: Partial<ChartWidgetOptions>; type: string }>([
    { options: {}, type: 'line' },
    { options: { type: 'bar' }, type: 'bar' }
  ])('renders a $type chart for options $options', ({ options, type }) => {
    renderChart(makeWidget(options), { labels: [], datasets: [] })

    expect(getChartByName(`test_chart - ${type} chart`)?.config).toMatchObject({
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

    const chartData = getChartByName('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual(['a', 'b'])
    expect(chartData?.datasets[0].label).toBe('x')
  })

  it.for<{ value: ChartValue; shape: string }>([
    { shape: 'null', value: null },
    { shape: 'an empty object', value: {} }
  ])(
    'falls back to empty labels and datasets when the value becomes $shape',
    async ({ value }) => {
      const { rerender } = renderChart(makeWidget(), {
        labels: ['a'],
        datasets: [{ label: 'x', data: [1] }]
      })

      await rerender({ modelValue: value })

      const chartData = getChartByName('test_chart - line chart')?.data
      expect(chartData?.labels).toEqual([])
      expect(chartData?.datasets).toEqual([])
    }
  )

  it('renders the data that arrives after an empty object', async () => {
    const { rerender } = renderChart(makeWidget(), {})

    await rerender({
      modelValue: { labels: ['b'], datasets: [{ label: 'y', data: [2] }] }
    })

    const chartData = getChartByName('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual(['b'])
    expect(chartData?.datasets[0].label).toBe('y')
  })

  it('updates the chart when the model value changes', async () => {
    const { rerender } = renderChart(makeWidget(), {
      labels: ['a'],
      datasets: [{ label: 'x', data: [1] }]
    })

    await rerender({
      modelValue: {
        labels: ['b', 'c'],
        datasets: [{ label: 'y', data: [2, 3] }]
      }
    })

    const chartData = getChartByName('test_chart - line chart')?.data
    expect(chartData?.labels).toEqual(['b', 'c'])
    expect(chartData?.datasets[0].label).toBe('y')
  })
})
