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

  const RING: Array<[number, string]> = [
    [0, 'front-view'],
    [45, 'front-right-quarter-view'],
    [90, 'right-side-view'],
    [135, 'back-right-quarter-view'],
    [180, 'back-view'],
    [225, 'back-left-quarter-view'],
    [270, 'left-side-view'],
    [315, 'front-left-quarter-view']
  ]

  it('resolves all eight azimuths on the eye-level medium ring exactly', () => {
    for (const [azimuth, slug] of RING) {
      expect(resolveAsset({ azimuth, elevation: 0, zoom: 5 }).src).toContain(
        `${slug}__eye-level-shot__medium-shot`
      )
    }
  })

  it('resolves all eight azimuths on the elevated medium ring exactly', () => {
    for (const [azimuth, slug] of RING) {
      expect(resolveAsset({ azimuth, elevation: 30, zoom: 5 }).src).toContain(
        `${slug}__elevated-shot__medium-shot`
      )
    }
  })

  it('degrades elevation to the nearest shipped label', () => {
    // Low-angle only ships for the left side view, so it is the one band that
    // still degrades; every other elevation resolves exactly on both rings.
    expect(resolveAsset({ azimuth: 0, elevation: -30, zoom: 5 }).src).toContain(
      'front-view__eye-level-shot'
    )
    expect(
      resolveAsset({ azimuth: 90, elevation: -30, zoom: 5 }).src
    ).toContain('right-side-view__eye-level-shot')
  })

  it('matches every shipped front-view distance bucket', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 9 }).src).toContain(
      'front-view__eye-level-shot__close-up'
    )
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 0 }).src).toContain(
      'front-view__eye-level-shot__wide-shot'
    )
  })

  it('degrades distance to the nearest shipped label when the bucket is missing', () => {
    // front high-angle ships medium + wide, so a close-up zoom degrades.
    expect(resolveAsset({ azimuth: 0, elevation: 60, zoom: 9 }).src).toContain(
      'front-view__high-angle-shot__medium-shot'
    )
  })

  it('keeps the azimuth of an off-bucket pose rather than rotating away', () => {
    // Both medium rings now cover all eight azimuths, so azimuth never has to
    // snap: an unshipped elevation/distance degrades within the same azimuth.
    expect(
      resolveAsset({ azimuth: 150, elevation: 60, zoom: 1 }).src
    ).toContain('back-right-quarter-view')
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
