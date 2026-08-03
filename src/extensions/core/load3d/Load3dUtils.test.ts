import { describe, expect, it } from 'vitest'

import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'

describe('Load3dUtils.mapSceneLightIntensityToHdri', () => {
  it('maps scene slider low end to a small positive HDRI intensity', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(1, 1, 10)).toBe(0.25)
    expect(Load3dUtils.mapSceneLightIntensityToHdri(10, 1, 10)).toBe(5)
  })

  it('maps midpoint proportionally', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(5.5, 1, 10)).toBeCloseTo(
      2.5
    )
  })

  it('clamps scene ratio and HDRI ceiling', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(-10, 1, 10)).toBe(0.25)
    expect(Load3dUtils.mapSceneLightIntensityToHdri(100, 1, 10)).toBe(5)
  })

  it('uses minimum HDRI when span is zero', () => {
    expect(Load3dUtils.mapSceneLightIntensityToHdri(3, 5, 5)).toBe(0.25)
  })
})
