import { afterEach, describe, expect, it } from 'vitest'

import { getLowQualityThreshold } from '@/renderer/extensions/vueNodes/composables/useLowQualityRendering'

const originalDpr = window.devicePixelRatio

function setDpr(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', {
    value,
    configurable: true
  })
}

afterEach(() => setDpr(originalDpr))

describe('getLowQualityThreshold', () => {
  it('matches the zoom at which text hits the minimum readable size', () => {
    setDpr(1)

    // NODE_TEXT_SIZE is 14, so 14px text renders at 7px once zoomed to 0.5.
    expect(getLowQualityThreshold(7)).toBeCloseTo(0.5, 5)
  })

  it('lets higher-DPI displays stay detailed longer', () => {
    setDpr(1)
    const at1x = getLowQualityThreshold(8)
    setDpr(4)
    const at4x = getLowQualityThreshold(8)

    // sqrt(4) = 2, so the threshold halves rather than quartering.
    expect(at4x).toBeCloseTo(at1x / 2, 5)
  })

  it('reports no threshold when LOD is disabled', () => {
    expect(getLowQualityThreshold(0)).toBe(0)
  })
})
