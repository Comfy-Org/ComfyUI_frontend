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

function circularDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
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
    expect(resolveAsset({ azimuth: 90, elevation: 30, zoom: 5 }).src).toContain(
      'az090-0__elevated-shot__medium-shot'
    )
    expect(resolveAsset({ azimuth: 90, elevation: 30, zoom: 0 }).src).toContain(
      'elevated-shot__wide-shot'
    )
    expect(
      resolveAsset({ azimuth: 90, elevation: 30, zoom: 10 }).src
    ).toContain('elevated-shot__close-up')
  })

  it('swaps elevation ring at the same azimuth and zoom', () => {
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
      'az022-0__elevated-shot__medium-shot'
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
      resolveAsset({ azimuth: 355, elevation: 30, zoom: 5 }).src
    ).toContain('az000-0__elevated-shot__medium-shot')
  })

  it('stays within half the ring frame spacing when snapping azimuth', () => {
    const rings = new Map<string, number[]>()
    for (const asset of ANGLE_ASSETS) {
      const key = `${asset.elevation}|${asset.distance}`
      rings.set(key, [...(rings.get(key) ?? []), asset.azimuthDegrees])
    }
    for (const [key, azimuths] of rings) {
      const sorted = [...azimuths].sort((a, b) => a - b)
      const maxGap = Math.max(
        ...sorted.map((az, i) =>
          i === sorted.length - 1 ? 360 - az + sorted[0] : sorted[i + 1] - az
        )
      )
      const [elevation, distance] = key.split('|')
      for (let azimuth = 0; azimuth < 360; azimuth += 15) {
        const asset = resolveAsset({
          azimuth,
          elevation: ELEVATION_FOR[elevation as ElevationLabel] ?? 0,
          zoom: ZOOM_FOR_DISTANCE[distance as DistanceLabel]
        })
        expect(asset.elevation).toBe(elevation)
        expect(asset.distance).toBe(distance)
        expect(
          circularDistance(asset.azimuthDegrees, azimuth)
        ).toBeLessThanOrEqual(maxGap / 2)
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
