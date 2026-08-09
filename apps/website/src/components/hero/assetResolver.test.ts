import { describe, expect, it } from 'vitest'

import type { DistanceLabel, ElevationLabel } from './cameraVocabulary'
import { ANGLE_ASSETS, resolveAsset } from './assetResolver'

const ELEVATION_FOR: Partial<Record<ElevationLabel, number>> = {
  'eye-level shot': 0,
  'elevated shot': 30
}

const ZOOM_FOR_DISTANCE: Record<DistanceLabel, number> = {
  'wide shot': 1,
  'medium shot': 5,
  'close-up': 8
}

describe('resolveAsset', () => {
  it('resolves every shipped pose to its exact frame', () => {
    for (const asset of ANGLE_ASSETS) {
      expect(
        resolveAsset({
          azimuth: asset.azimuthDegrees,
          elevation: ELEVATION_FOR[asset.elevation] ?? 0,
          zoom: ZOOM_FOR_DISTANCE[asset.distance]
        })
      ).toBe(asset)
    }
  })

  it('swaps distance ring with zoom at the same pose', () => {
    expect(resolveAsset({ azimuth: 90, elevation: 0, zoom: 0 }).src).toContain(
      'az090-0__eye-level-shot__wide-shot'
    )
    expect(resolveAsset({ azimuth: 90, elevation: 0, zoom: 5 }).src).toContain(
      'az090-0__eye-level-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 90, elevation: 0, zoom: 10 }).src).toContain(
      'az090-0__eye-level-shot__close-up'
    )
    expect(resolveAsset({ azimuth: 72, elevation: 30, zoom: 0 }).src).toContain(
      'az072-0__elevated-shot__wide-shot'
    )
    expect(
      resolveAsset({ azimuth: 72, elevation: 30, zoom: 10 }).src
    ).toContain('az072-0__elevated-shot__close-up')
  })

  it('swaps elevation ring with the same azimuth and zoom', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 0, zoom: 5 }).src).toContain(
      'az000-0__eye-level-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: 30, zoom: 5 }).src).toContain(
      'az000-0__elevated-shot__medium-shot'
    )
  })

  it('snaps an off-bucket azimuth to the nearest frame in the ring', () => {
    expect(resolveAsset({ azimuth: 10, elevation: 0, zoom: 5 }).src).toContain(
      'az000-0'
    )
    expect(resolveAsset({ azimuth: 12, elevation: 0, zoom: 5 }).src).toContain(
      'az022-5'
    )
    expect(resolveAsset({ azimuth: 200, elevation: 0, zoom: 5 }).src).toContain(
      'az202-5'
    )
    expect(resolveAsset({ azimuth: 20, elevation: 30, zoom: 5 }).src).toContain(
      'az036-0__elevated-shot__medium-shot'
    )
  })

  it('wraps azimuth distance across 0°', () => {
    expect(resolveAsset({ azimuth: 350, elevation: 0, zoom: 5 }).src).toContain(
      'az000-0'
    )
    expect(resolveAsset({ azimuth: 340, elevation: 0, zoom: 5 }).src).toContain(
      'az337-5'
    )
    expect(
      resolveAsset({ azimuth: 350, elevation: 30, zoom: 5 }).src
    ).toContain('az000-0__elevated-shot__medium-shot')
  })

  it('keeps the pose azimuth when scrubbing elevation and zoom', () => {
    for (const elevation of [-30, 0, 30, 60]) {
      for (const zoom of [0, 5, 10]) {
        const asset = resolveAsset({ azimuth: 180, elevation, zoom })
        expect(asset.azimuthDegrees).toBe(180)
      }
    }
  })

  it('snaps unshipped elevation bands to the nearest ring', () => {
    expect(resolveAsset({ azimuth: 0, elevation: 60, zoom: 5 }).src).toContain(
      'elevated-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 0, elevation: -30, zoom: 5 }).src).toContain(
      'eye-level-shot__medium-shot'
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
