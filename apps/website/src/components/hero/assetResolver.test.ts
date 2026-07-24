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

  it('resolves every shipped azimuth on the eye-level medium ring exactly', () => {
    const ring: Array<[number, string]> = [
      [45, 'front-right-quarter-view'],
      [90, 'right-side-view'],
      [225, 'back-left-quarter-view'],
      [315, 'front-left-quarter-view']
    ]
    for (const [azimuth, slug] of ring) {
      expect(resolveAsset({ azimuth, elevation: 0, zoom: 5 }).src).toContain(
        `${slug}__eye-level-shot__medium-shot`
      )
    }
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

  it('degrades distance to the nearest shipped label when the bucket is missing', () => {
    // front eye-level ships only medium, so close-up and wide zooms degrade.
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 9 }).src).toContain(
      'front-view__eye-level-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 0 }).src).toContain(
      'front-view__eye-level-shot__medium-shot'
    )
    // front high-angle ships medium + wide, so a close-up zoom degrades.
    expect(resolveAsset({ azimuth: 0, elevation: 60, zoom: 9 }).src).toContain(
      'front-view__high-angle-shot__medium-shot'
    )
  })

  it('snaps unshipped poses to the circularly nearest asset', () => {
    // back-right quarter view is unshipped; 150 degrees is nearer back view.
    expect(resolveAsset({ azimuth: 150, elevation: 0, zoom: 5 }).src).toContain(
      'back-view__eye-level-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 270, elevation: 0, zoom: 8 }).src).toContain(
      'left-side-view'
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
