/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import type { ChartData } from 'chart.js'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { ChartInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetChart from './WidgetChart.vue'
import { createMockWidget } from './widgetTestUtils'

type ChartWidgetOptions = NonNullable<ChartInputSpec['options']> &
  IWidgetOptions

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { chart: 'Chart', chartLowercase: 'chart' } } }
})

const ChartStub = defineComponent({
  name: 'Chart',
  props: {
    type: { type: String, default: '' },
    data: { type: Object, default: () => ({}) },
    options: { type: Object, default: () => ({}) }
  },
  template:
    '<div data-testid="chart" :data-chart-type="type" :data-chart-data="JSON.stringify(data)" v-bind="$attrs" />'
})

function makeWidget(
  options: Partial<ChartWidgetOptions> = {}
): SimplifiedWidget<ChartData, ChartWidgetOptions> {
  return createMockWidget<ChartData>({
    value: { labels: [], datasets: [] },
    name: 'test_chart',
    type: 'chart',
    options: options as ChartWidgetOptions
  }) as SimplifiedWidget<ChartData, ChartWidgetOptions>
}

function renderChart(
  widget: SimplifiedWidget<ChartData, ChartWidgetOptions>,
  modelValue: ChartData
) {
  const value = ref<ChartData>(modelValue)
  const Harness = defineComponent({
    components: { WidgetChart },
    setup: () => ({ widget, value }),
    template: '<WidgetChart :widget="widget" v-model="value" />'
  })
  const utils = render(Harness, {
    global: { plugins: [i18n], stubs: { Chart: ChartStub } }
  })
  return { ...utils, value }
}

describe('WidgetChart', () => {
  describe('Chart type selection', () => {
    it('defaults to "line" when no type option is set', () => {
      renderChart(makeWidget(), { labels: [], datasets: [] })
      expect(screen.getByTestId('chart')).toHaveAttribute(
        'data-chart-type',
        'line'
      )
    })

    it('uses the type from widget.options when provided', () => {
      renderChart(makeWidget({ type: 'bar' }), { labels: [], datasets: [] })
      expect(screen.getByTestId('chart')).toHaveAttribute(
        'data-chart-type',
        'bar'
      )
    })
  })

  describe('Chart data binding', () => {
    it('passes model value through to the Chart component', () => {
      const data: ChartData = {
        labels: ['a', 'b'],
        datasets: [{ label: 'x', data: [1, 2] }]
      }
      renderChart(makeWidget(), data)
      const parsed = JSON.parse(screen.getByTestId('chart').dataset.chartData!)
      expect(parsed.labels).toEqual(['a', 'b'])
      expect(parsed.datasets[0].label).toBe('x')
    })

    it('falls back to empty labels/datasets when value becomes null', async () => {
      const { value } = renderChart(makeWidget(), {
        labels: ['a'],
        datasets: [{ label: 'x', data: [1] }]
      })
      value.value = null as unknown as ChartData
      await nextTick()

      const parsed = JSON.parse(screen.getByTestId('chart').dataset.chartData!)
      expect(parsed).toEqual({ labels: [], datasets: [] })
    })

    it('reactively updates the chart when model value changes', async () => {
      const { value } = renderChart(makeWidget(), {
        labels: ['a'],
        datasets: [{ label: 'x', data: [1] }]
      })

      value.value = {
        labels: ['b', 'c'],
        datasets: [{ label: 'y', data: [2, 3] }]
      }
      await nextTick()

      const parsed = JSON.parse(screen.getByTestId('chart').dataset.chartData!)
      expect(parsed.labels).toEqual(['b', 'c'])
      expect(parsed.datasets[0].label).toBe('y')
    })
  })

  describe('Accessibility', () => {
    it('sets an aria-label that includes the widget name and chart type', () => {
      renderChart(makeWidget({ type: 'bar' }), { labels: [], datasets: [] })
      const chart = screen.getByTestId('chart')
      expect(chart.getAttribute('aria-label')).toContain('test_chart')
      expect(chart.getAttribute('aria-label')).toContain('bar')
    })

    it('uses the translated "Chart" label when the widget has no name', () => {
      const widget = makeWidget()
      widget.name = ''
      renderChart(widget, { labels: [], datasets: [] })
      const chart = screen.getByTestId('chart')
      expect(chart.getAttribute('aria-label')).toContain('Chart')
    })
  })
})
