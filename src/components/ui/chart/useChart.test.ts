import { Chart } from 'chart.js'
import type { ChartDataset, Color } from 'chart.js'
import { describe, expect, it } from 'vitest'

import './useChart'

interface ColorDescriptor {
  backgroundColor?: Color
  borderColor?: Color
}

interface ColorsChart {
  config: {
    data: { datasets: ChartDataset<'line'>[] }
    options: ColorDescriptor & {
      elements?: Record<string, ColorDescriptor>
    }
  }
  getDatasetMeta: (datasetIndex: number) => { controller: object }
}

interface ColorsPlugin {
  beforeLayout: (
    chart: ColorsChart,
    args: { cancelable: boolean },
    options: { enabled: boolean; forceOverride: boolean }
  ) => void
}

function isColorsPlugin(plugin: unknown): plugin is ColorsPlugin {
  return (
    typeof plugin === 'object' &&
    plugin !== null &&
    'beforeLayout' in plugin &&
    typeof plugin.beforeLayout === 'function'
  )
}

describe('useChart', () => {
  it('applies Chart.js colors to datasets without explicit colors', () => {
    const dataset: ChartDataset<'line'> = { data: [1, 2] }
    const colors: unknown = Chart.registry.getPlugin('colors')
    expect(isColorsPlugin(colors)).toBe(true)
    if (!isColorsPlugin(colors))
      throw new Error('Colors plugin is not registered')
    const chart: ColorsChart = {
      config: {
        data: { datasets: [dataset] },
        options: {}
      },
      getDatasetMeta: () => ({ controller: {} })
    }

    colors.beforeLayout(
      chart,
      { cancelable: true },
      { enabled: true, forceOverride: false }
    )

    expect(dataset.borderColor).toBe('rgb(54, 162, 235)')
    expect(dataset.backgroundColor).toBe('rgba(54, 162, 235, 0.5)')
  })
})
