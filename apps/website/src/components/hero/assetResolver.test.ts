import { describe, expect, it } from 'vitest'

import { ANGLE_ASSETS, resolveAsset } from './assetResolver'

describe('resolveAsset', () => {
  it('resolves every turntable azimuth to its exact frame', () => {
    for (const asset of ANGLE_ASSETS) {
      expect(
        resolveAsset({ azimuth: asset.azimuthDegrees, elevation: 0, zoom: 5 })
      ).toBe(asset)
    }
  })

  it('snaps an off-bucket azimuth to the nearest frame', () => {
    expect(resolveAsset({ azimuth: 10, elevation: 0, zoom: 5 }).src).toContain(
      'az000-0'
    )
    expect(resolveAsset({ azimuth: 12, elevation: 0, zoom: 5 }).src).toContain(
      'az022-5'
    )
    expect(resolveAsset({ azimuth: 200, elevation: 0, zoom: 5 }).src).toContain(
      'az202-5'
    )
  })

  it('wraps azimuth distance across 0°', () => {
    expect(resolveAsset({ azimuth: 350, elevation: 0, zoom: 5 }).src).toContain(
      'az000-0'
    )
    expect(resolveAsset({ azimuth: 340, elevation: 0, zoom: 5 }).src).toContain(
      'az337-5'
    )
  })

  it('degrades unshipped elevation and distance within the same azimuth', () => {
    for (const elevation of [-30, 0, 30, 60]) {
      for (const zoom of [0, 5, 10]) {
        const asset = resolveAsset({ azimuth: 90, elevation, zoom })
        expect(asset.azimuthDegrees).toBe(90)
      }
    }
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
