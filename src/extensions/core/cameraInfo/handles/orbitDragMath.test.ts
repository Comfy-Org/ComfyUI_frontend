import { describe, expect, it } from 'vitest'

import {
  MAX_DISTANCE,
  MAX_PITCH,
  MIN_DISTANCE,
  MIN_PITCH,
  pointToDistance,
  pointToPitchAngle,
  pointToYawAngle
} from './orbitDragMath'

const TARGET = { x: 0, y: 0, z: 0 }
const SHIFTED_TARGET = { x: 2, y: 1, z: -3 }

describe('pointToYawAngle', () => {
  it('returns 0 when the point sits on +Z relative to the target', () => {
    expect(pointToYawAngle({ x: 0, y: 0, z: 5 }, TARGET)).toBeCloseTo(0)
  })

  it('returns 90 when the point sits on +X (rotation around Y)', () => {
    expect(pointToYawAngle({ x: 5, y: 0, z: 0 }, TARGET)).toBeCloseTo(90)
  })

  it('returns -90 when the point sits on -X', () => {
    expect(pointToYawAngle({ x: -5, y: 0, z: 0 }, TARGET)).toBeCloseTo(-90)
  })

  it('returns 180 (or -180) when the point sits on -Z', () => {
    expect(
      Math.abs(pointToYawAngle({ x: 0, y: 0, z: -5 }, TARGET))
    ).toBeCloseTo(180)
  })

  it('is invariant to the y component of the point and target', () => {
    expect(
      pointToYawAngle({ x: 3, y: 99, z: 4 }, { x: 0, y: -7, z: 0 })
    ).toBeCloseTo(pointToYawAngle({ x: 3, y: 0, z: 4 }, TARGET))
  })

  it('works against a non-origin target', () => {
    expect(
      pointToYawAngle(
        { x: SHIFTED_TARGET.x, y: 0, z: SHIFTED_TARGET.z + 5 },
        SHIFTED_TARGET
      )
    ).toBeCloseTo(0)
  })
})

describe('pointToPitchAngle', () => {
  it('returns 0 when the point lies in the horizontal plane', () => {
    expect(pointToPitchAngle({ x: 0, y: 0, z: 5 }, TARGET, 0)).toBeCloseTo(0)
  })

  it('returns +45 for a point lifted to (0, h, h) at yaw=0', () => {
    expect(pointToPitchAngle({ x: 0, y: 5, z: 5 }, TARGET, 0)).toBeCloseTo(45)
  })

  it('returns -30 for a downward-pointing intersection at yaw=0', () => {
    const h = 5
    const v = h * Math.tan((30 * Math.PI) / 180)
    expect(pointToPitchAngle({ x: 0, y: -v, z: h }, TARGET, 0)).toBeCloseTo(-30)
  })

  it('respects the current yaw direction when projecting horizontally', () => {
    expect(pointToPitchAngle({ x: 5, y: 5, z: 0 }, TARGET, 90)).toBeCloseTo(45)
  })

  it('clamps to MAX_PITCH past the upper pole', () => {
    expect(pointToPitchAngle({ x: 0, y: 100, z: 0.001 }, TARGET, 0)).toBe(
      MAX_PITCH
    )
  })

  it('clamps to MIN_PITCH past the lower pole', () => {
    expect(pointToPitchAngle({ x: 0, y: -100, z: 0.001 }, TARGET, 0)).toBe(
      MIN_PITCH
    )
  })
})

describe('pointToDistance', () => {
  it('returns the radial projection at yaw=0, pitch=0', () => {
    expect(pointToDistance({ x: 0, y: 0, z: 7 }, TARGET, 0, 0)).toBeCloseTo(7)
  })

  it('returns the radial projection along the current yaw direction', () => {
    expect(pointToDistance({ x: 4, y: 0, z: 0 }, TARGET, 90, 0)).toBeCloseTo(4)
  })

  it('ignores off-axis components of the point', () => {
    expect(pointToDistance({ x: 99, y: 0, z: 5 }, TARGET, 0, 0)).toBeCloseTo(5)
  })

  it('clamps to MIN_DISTANCE when the projection goes behind the target', () => {
    expect(pointToDistance({ x: 0, y: 0, z: -10 }, TARGET, 0, 0)).toBe(
      MIN_DISTANCE
    )
  })

  it('clamps to MAX_DISTANCE when the projection overshoots', () => {
    expect(pointToDistance({ x: 0, y: 0, z: 99999 }, TARGET, 0, 0)).toBe(
      MAX_DISTANCE
    )
  })
})
