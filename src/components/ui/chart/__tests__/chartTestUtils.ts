import { screen } from '@testing-library/vue'
import { Chart } from 'chart.js'
import { assert } from 'vitest'

export function getChartByName(name: string): Chart | undefined {
  const canvas = screen.getByRole('img', { name })
  assert(canvas instanceof HTMLCanvasElement)
  return Chart.getChart(canvas)
}
