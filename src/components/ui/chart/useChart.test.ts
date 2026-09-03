import { fromPartial } from '@total-typescript/shoehorn'
import { Chart } from 'chart.js'
import type { ChartDataset } from 'chart.js'
import { describe, expect, it } from 'vitest'

import './useChart'

describe('useChart', () => {
  it('applies Chart.js colors to datasets without explicit colors', () => {
    const dataset: ChartDataset<'line'> = { data: [1, 2] }
    const colors = Chart.registry.getPlugin('colors')
    expect(colors).toBeDefined()
    if (!colors) throw new Error('Colors plugin is not registered')
    const chart = fromPartial<Chart<'line'>>({
      config: fromPartial<Chart<'line'>['config']>({
        data: { datasets: [dataset] },
        options: {}
      }),
      getDatasetMeta: () =>
        fromPartial<ReturnType<Chart<'line'>['getDatasetMeta']>>({
          controller: fromPartial<
            ReturnType<Chart<'line'>['getDatasetMeta']>['controller']
          >({})
        })
    })

    colors.beforeLayout?.(
      chart,
      { cancelable: true },
      { enabled: true, forceOverride: false }
    )

    expect(dataset.borderColor).toBe('rgb(54, 162, 235)')
    expect(dataset.backgroundColor).toBe('rgba(54, 162, 235, 0.5)')
  })
})
