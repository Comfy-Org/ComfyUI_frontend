import { describe, expect, it } from 'vitest'

import type { Motion, Vec3 } from './camera'
import {
  estimatePivot,
  orbitPose,
  samplePath,
  sourceAim,
  zoneOf
} from './camera'
// Written by the node pack's own functions (_orbit_C_tgt, _sample_path and
// build()'s pivot estimate), so these tests hold the port to the original.
import fixtures from './camera.fixtures.json'

describe('the CrossView camera port', () => {
  it.for(fixtures.orbit)(
    'places the camera where the node does (az $az, el $el)',
    ({ az, el, dist, pivot, keepAim, C }) => {
      const p = pivot as unknown as Vec3
      const pose = orbitPose(
        az,
        el,
        dist,
        p,
        keepAim ? sourceAim(p) : undefined
      )
      Array.from(pose).forEach((value, i) => expect(value).toBeCloseTo(C[i], 4))
    }
  )

  it.for(fixtures.paths)(
    'samples a $motion move as the node does',
    ({ motion, samples }) => {
      for (const [frame, expected] of Object.entries(samples)) {
        const pose = samplePath(
          fixtures.keyframes,
          Number(frame),
          motion as Motion
        )
        for (const [key, value] of Object.entries(expected))
          expect(
            pose[key as keyof typeof pose],
            `${key} at ${frame}`
          ).toBeCloseTo(value, 6)
      }
    }
  )

  it('finds the pivot build() would', () => {
    const { width, height, fx, depth, expected } = fixtures.pivot
    const plane = Float32Array.from(depth, (z) => (z === null ? NaN : z))
    const pivot = estimatePivot(plane, width, height, fx)
    pivot.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 4))
  })

  it('marks the trained ranges', () => {
    expect(zoneOf(-30, 15)).toBe('green')
    expect(zoneOf(80, 0)).toBe('yellow')
    expect(zoneOf(0, -40)).toBe('red')
  })
})
