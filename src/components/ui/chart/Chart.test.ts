import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { Chart } from 'chart.js'
import type { ChartData } from 'chart.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, toRaw } from 'vue'

import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { getChartByName } from './__tests__/chartTestUtils'
import ChartComponent from './Chart.vue'

describe('Chart', () => {
  beforeEach(stubCanvasGetContext)

  it('colors datasets that do not set their own colors', () => {
    render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Uncolored chart',
        data: { labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] }
      }
    })

    const dataset = getChartByName('Uncolored chart')?.data.datasets[0]

    expect(dataset?.borderColor).toEqual(expect.any(String))
    expect(dataset?.backgroundColor).toEqual(expect.any(String))
  })

  it('renders a dataset that has no data array', () => {
    render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Partial chart',
        data: fromPartial<ChartData>({
          labels: ['a'],
          datasets: [{ label: 'x' }]
        })
      }
    })

    expect(getChartByName('Partial chart')).toBeDefined()
  })

  it('keeps Chart.js writes out of the caller data', async () => {
    const data = reactive({
      labels: ['a', 'b'],
      datasets: [{ label: 'x', data: [1, 2] }]
    })
    render(ChartComponent, {
      props: { type: 'line', label: 'Caller chart', data }
    })
    expect(toRaw(data.datasets[0])).toEqual({ label: 'x', data: [1, 2] })
    expect(toRaw(data.datasets[0].data).push).toBe(Array.prototype.push)

    data.datasets[0].data.push(3)
    await nextTick()

    expect(
      getChartByName('Caller chart')?.data.datasets[0].borderColor
    ).toEqual(expect.any(String))
    expect(toRaw(data.datasets[0])).toEqual({ label: 'x', data: [1, 2, 3] })
  })

  it('keeps category labels Chart.js discovers out of the caller labels', () => {
    const labels: string[] = []
    const { unmount } = render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Category chart',
        data: fromAny<ChartData, unknown>({
          labels,
          datasets: [
            {
              label: 'x',
              data: [
                { x: 'mon', y: 1 },
                { x: 'tue', y: 2 }
              ]
            }
          ]
        })
      }
    })

    unmount()

    expect(labels).toEqual([])
  })

  it('targets the nearest index on hover without a point hit', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 400, 200)
    )
    render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Hover chart',
        data: { labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] }
      }
    })
    const chart = getChartByName('Hover chart')
    const interaction = chart?.options.interaction
    if (!chart || !interaction?.mode) throw new Error('chart was not created')
    const xScale = chart.scales.x
    const betweenPoints = new MouseEvent('mousemove', {
      clientX:
        (xScale.getPixelForValue(0) * 3 + xScale.getPixelForValue(1)) / 4,
      clientY: chart.chartArea.top
    })

    const elements = chart.getElementsAtEventForMode(
      betweenPoints,
      interaction.mode,
      interaction,
      true
    )

    expect(elements.map(({ index }) => index)).toEqual([0])
  })

  it('switches to the new chart type when the type changes', async () => {
    const { rerender } = render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Typed chart',
        data: { labels: ['a'], datasets: [{ label: 'x', data: [1] }] }
      }
    })

    await rerender({ type: 'bar' })

    expect(getChartByName('Typed chart')?.config).toMatchObject({
      type: 'bar'
    })
  })

  it.for<{
    apply: (values: number[]) => void
    edit: string
    expected: number[]
  }>([
    {
      edit: 'index assignment',
      apply: (values) => (values[0] = 5),
      expected: [5, 2]
    },
    { edit: 'push', apply: (values) => values.push(3), expected: [1, 2, 3] }
  ])(
    'redraws when the data is edited in place by $edit',
    async ({ apply, expected }) => {
      const data = reactive({
        labels: ['a', 'b'],
        datasets: [{ label: 'x', data: [1, 2] }]
      })
      render(ChartComponent, {
        props: { type: 'line', label: 'Edited chart', data }
      })
      const update = vi.spyOn(Chart.prototype, 'update')

      apply(data.datasets[0].data)
      await nextTick()

      expect(update).toHaveBeenCalled()
      expect(getChartByName('Edited chart')?.data.datasets[0].data).toEqual(
        expected
      )
    }
  )
})
