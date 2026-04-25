import { describe, expect, it } from 'vitest'

import { computeCameraFromMatrices } from './cameraFromMatrices'

const IDENTITY_R = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
] as const

function extrinsics(
  r: readonly (readonly number[])[],
  t: readonly number[]
): number[][] {
  return [
    [r[0][0], r[0][1], r[0][2], t[0]],
    [r[1][0], r[1][1], r[1][2], t[1]],
    [r[2][0], r[2][1], r[2][2], t[2]],
    [0, 0, 0, 1]
  ]
}

function intrinsics(
  fx: number,
  fy: number,
  cx: number,
  cy: number
): number[][] {
  return [
    [fx, 0, cx],
    [0, fy, cy],
    [0, 0, 1]
  ]
}

function closeTo(received: readonly number[], expected: readonly number[]) {
  expect(received.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    expect(received[i]).toBeCloseTo(expected[i], 6)
  }
}

describe('computeCameraFromMatrices', () => {
  it('places camera at origin when extrinsics are identity', () => {
    const result = computeCameraFromMatrices(
      extrinsics(IDENTITY_R, [0, 0, 0]),
      intrinsics(500, 500, 320, 240)
    )

    closeTo(result.position, [0, 0, 0])
    // Identity forward (0,0,1) in OpenCV world -> after 180° rotation about X
    // becomes (0,0,-1) in three.js world (camera looks toward -Z, same as
    // three.js PerspectiveCamera default).
    closeTo(result.target, [0, 0, -1])
  })

  it('computes position as -R^T * t for a pure-translation extrinsic (Z flipped to three.js)', () => {
    // World-to-camera t = (0, 0, -5) means world origin is 5 units behind
    // camera in OpenCV frame. -R^T * t = (0, 0, 5) in OpenCV world.
    // After world-rotation 180° about X: three.js position = (0, 0, -5).
    const result = computeCameraFromMatrices(
      extrinsics(IDENTITY_R, [0, 0, -5]),
      intrinsics(500, 500, 320, 240)
    )

    closeTo(result.position, [0, 0, -5])
    // Target is one step along camera +Z in OpenCV = (0, 0, 6), then Z-flip
    // gives three.js target = (0, 0, -6).
    closeTo(result.target, [0, 0, -6])
  })

  it('rotates forward direction using the third row of R', () => {
    // R whose third row = (1, 0, 0): camera +Z axis points along world +X
    // in OpenCV. X is not flipped by the OpenCV->three.js rotation, so the
    // forward ray stays along +X in three.js world.
    const r = [
      [0, 0, -1],
      [0, 1, 0],
      [1, 0, 0]
    ]

    const result = computeCameraFromMatrices(
      extrinsics(r, [0, 0, 0]),
      intrinsics(500, 500, 320, 240)
    )

    closeTo(result.position, [0, 0, 0])
    closeTo(result.target, [1, 0, 0])
  })

  it('applies Y-flip to convert OpenCV Y-down to three.js Y-up', () => {
    // Camera at OpenCV world Y = 3 (below origin in Y-down world).
    // After 180° rotation about X: three.js Y = -3 (below in Y-up world).
    const result = computeCameraFromMatrices(
      extrinsics(IDENTITY_R, [0, -3, 0]),
      intrinsics(500, 500, 320, 240)
    )

    closeTo(result.position, [0, -3, 0])
  })

  it('computes vertical FOV from fy and cy', () => {
    // fy = 500, cy = 250 → fov_y = 2 * atan(0.5) ≈ 53.13°
    const result = computeCameraFromMatrices(
      extrinsics(IDENTITY_R, [0, 0, 0]),
      intrinsics(500, 500, 320, 250)
    )

    expect(result.fovYDegrees).toBeCloseTo(53.1301023542, 6)
  })

  it('throws when extrinsics is not 4x4', () => {
    expect(() =>
      computeCameraFromMatrices(
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ],
        intrinsics(500, 500, 320, 240)
      )
    ).toThrow(/extrinsics/)
  })

  it('throws when intrinsics is not 3x3', () => {
    expect(() =>
      computeCameraFromMatrices(extrinsics(IDENTITY_R, [0, 0, 0]), [
        [500, 0, 320, 0],
        [0, 500, 240, 0],
        [0, 0, 1, 0]
      ])
    ).toThrow(/intrinsics/)
  })

  it.each([
    ['zero', 0],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY]
  ])(
    'throws when fy is %s rather than producing a NaN/Infinite FOV',
    (_label, fy) => {
      expect(() =>
        computeCameraFromMatrices(
          extrinsics(IDENTITY_R, [0, 0, 0]),
          intrinsics(500, fy, 320, 240)
        )
      ).toThrow(/fy/)
    }
  )
})
