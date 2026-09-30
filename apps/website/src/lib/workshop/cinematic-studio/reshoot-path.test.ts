import { describe, expect, it } from 'vitest'

import type { CameraKey, ReshootCamera } from './reshoot'
import { DEFAULT_CAMERA } from './reshoot'
import { cameraAt, keyIndexAt, roundCamera, toKeyframes } from './reshoot-path'

const at = (frame: number, camera: Partial<ReshootCamera>): CameraKey => ({
  frame,
  camera: { ...DEFAULT_CAMERA, ...camera }
})

describe('the camera move', () => {
  const keys = [at(0, { azimuth: -40 }), at(100, { azimuth: 40 })]

  it('is the one camera with no keys, and a single key holds', () => {
    expect(cameraAt([], 50, 'linear', DEFAULT_CAMERA)).toEqual(DEFAULT_CAMERA)
    expect(
      cameraAt([at(10, { azimuth: 20 })], 90, 'linear', DEFAULT_CAMERA).azimuth
    ).toBe(20)
  })

  it('flies between keys and holds past either end', () => {
    expect(cameraAt(keys, 50, 'linear', DEFAULT_CAMERA).azimuth).toBeCloseTo(0)
    expect(cameraAt(keys, 25, 'linear', DEFAULT_CAMERA).azimuth).toBeCloseTo(
      -20
    )
    expect(cameraAt(keys, 25, 'ease_in', DEFAULT_CAMERA).azimuth).toBeLessThan(
      -20
    )
    expect(cameraAt(keys, 106, 'linear', DEFAULT_CAMERA).azimuth).toBe(40)
  })

  it('keeps the lens off the path: the node takes one for the clip', () => {
    const wide = { ...DEFAULT_CAMERA, fov: 90 }
    expect(cameraAt([at(0, { fov: 30 })], 0, 'linear', wide).fov).toBe(90)
    expect(cameraAt(keys, 50, 'linear', wide).fov).toBe(90)
  })

  it('hands the node 1-based keyframes around the pivot', () => {
    expect(
      toKeyframes([at(0, { azimuth: -40, shift: 0.1 })], [1, 2, 3])
    ).toEqual([
      { f: 1, az: -40, el: 15, dist: 1, vs: 0.1, px: 1, py: 2, pz: 3 }
    ])
  })

  it('rounds for the controls and finds a key by frame', () => {
    expect(
      roundCamera({ ...DEFAULT_CAMERA, azimuth: -12.6, distance: 1.234 })
    ).toMatchObject({ azimuth: -13, distance: 1.23 })
    expect(keyIndexAt(keys, 100)).toBe(1)
    expect(keyIndexAt(keys, 99)).toBe(-1)
  })
})
