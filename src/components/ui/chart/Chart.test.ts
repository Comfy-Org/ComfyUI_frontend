import { render, screen } from '@testing-library/vue'
import { Chart } from 'chart.js'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, toRaw } from 'vue'

import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import ChartComponent from './Chart.vue'

function getChart(name: string) {
  const canvas = screen.getByRole('img', { name })
  assert(canvas instanceof HTMLCanvasElement)
  return Chart.getChart(canvas)
}

describe('Chart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement, _contextId: string) {
        return createMockCanvasRenderingContext2D({ canvas: this })
      } as HTMLCanvasElement['getContext']
    )
  })

  it('colors datasets that do not set their own colors', () => {
    render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Uncolored chart',
        data: { labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] }
      }
    })

    const dataset = getChart('Uncolored chart')?.data.datasets[0]

    expect(dataset?.borderColor).toEqual(expect.any(String))
    expect(dataset?.backgroundColor).toEqual(expect.any(String))
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

    data.datasets[0].data.push(3)
    await nextTick()

    expect(getChart('Caller chart')?.data.datasets[0].borderColor).toEqual(
      expect.any(String)
    )
    expect(toRaw(data.datasets[0])).toEqual({ label: 'x', data: [1, 2, 3] })
  })

  it('recreates the chart when the type changes', async () => {
    const { rerender } = render(ChartComponent, {
      props: {
        type: 'line',
        label: 'Typed chart',
        data: { labels: ['a'], datasets: [{ label: 'x', data: [1] }] }
      }
    })

    await rerender({ type: 'bar' })

    expect(getChart('Typed chart')?.config).toMatchObject({ type: 'bar' })
  })

  it.for<{ edit: string; apply: (values: number[]) => void }>([
    { edit: 'index assignment', apply: (values) => (values[0] = 5) },
    { edit: 'push', apply: (values) => values.push(3) }
  ])('redraws when the data is edited in place by $edit', async ({ apply }) => {
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
  })
})
