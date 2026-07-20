import { describe, expect, it } from 'vitest'

import { ANGLE_ASSETS, resolveAsset } from './assetResolver'

describe('resolveAsset', () => {
  it('returns the exact asset when the pose matches one', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 5 }).src).toContain(
      'front-view__eye-level-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 180, elevation: 0, zoom: 4 }).src).toContain(
      'back-view__eye-level-shot__medium-shot'
    )
  })

  it('degrades elevation to the nearest shipped label via raw-degree tiebreak', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 40, zoom: 5 }).src).toContain(
      'high-angle-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: 20, zoom: 5 }).src).toContain(
      'eye-level-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: -30, zoom: 5 }).src).toContain(
      'eye-level-shot'
    )
  })

  it('degrades distance to the nearest shipped label', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 9 }).src).toContain(
      'medium-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 0 }).src).toContain(
      'wide-shot'
    )
  })

  it('snaps unshipped azimuths to the circularly nearest asset', () => {
    expect(resolveAsset({ azimuth: 315, elevation: 0, zoom: 5 }).src).toContain(
      'front-view'
    )
    expect(resolveAsset({ azimuth: 150, elevation: 0, zoom: 5 }).src).toContain(
      'back-view'
    )
  })

  it('never returns a missing asset for any grid pose', () => {
    for (let azimuth = 0; azimuth < 360; azimuth += 15) {
      for (let elevation = -30; elevation <= 60; elevation += 15) {
        for (let zoom = 0; zoom <= 10; zoom += 2.5) {
          const asset = resolveAsset({ azimuth, elevation, zoom })
          expect(ANGLE_ASSETS).toContain(asset)
        }
      }
    }
  })
})
