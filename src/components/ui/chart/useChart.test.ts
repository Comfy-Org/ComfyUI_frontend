import { render, screen } from '@testing-library/vue'
import { Chart } from 'chart.js'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import ChartComponent from './Chart.vue'

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const state: Partial<CanvasRenderingContext2D> = { canvas }
  return new Proxy(state, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property)
      if (property === 'measureText') return () => ({ width: 0 })
      return () => undefined
    },
    set: (target, property, value) => Reflect.set(target, property, value)
  }) as CanvasRenderingContext2D
}

describe('useChart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement, _contextId: string) {
        return fakeContext(this)
      } as HTMLCanvasElement['getContext']
    )
  })

  it('colors datasets that do not set their own colors', () => {
    render(ChartComponent, {
      props: {
        type: 'line',
        ariaLabel: 'Uncolored chart',
        data: { labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] }
      }
    })

    const canvas = screen.getByRole('img', { name: 'Uncolored chart' })
    assert(canvas instanceof HTMLCanvasElement)
    const dataset = Chart.getChart(canvas)?.data.datasets[0]

    expect(dataset?.borderColor).toBe('rgb(54, 162, 235)')
    expect(dataset?.backgroundColor).toBe('rgba(54, 162, 235, 0.5)')
  })
})
