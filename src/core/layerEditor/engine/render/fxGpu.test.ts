import { describe, expect, it } from 'vitest'

import { applyLayerFxChainGpu, fxGpuAvailable } from './fxGpu'
import type { LayerFxData } from './layerFx'

const fx = (op: LayerFxData['op']): LayerFxData => ({
  id: op,
  op,
  params: {},
  enabled: true,
  opacity: 1
})

describe('fxGpu graceful degradation', () => {
  it('reports unavailable without WebGL2 (this test environment) and returns null', () => {
    expect(fxGpuAvailable()).toBe(false)
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    expect(applyLayerFxChainGpu(canvas, [fx('gaussian-blur')], 4)).toBeNull()
  })

  it('declines chains containing median-blur (CPU-only op)', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    expect(applyLayerFxChainGpu(canvas, [fx('median-blur')], 0)).toBeNull()
  })
})
