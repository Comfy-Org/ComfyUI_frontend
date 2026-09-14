import { describe, expect, it } from 'vitest'

import { pointToRollAngle, rollBasis } from './rollDragMath'

const TARGET = { x: 0, y: 0, z: 0 }

describe('rollBasis', () => {
  it('returns world (+X right, +Y up) when the camera looks along -Z', () => {
    const basis = rollBasis(TARGET, { x: 0, y: 0, z: 5 })
    expect(basis.up.x).toBeCloseTo(0)
    expect(basis.up.y).toBeCloseTo(1)
    expect(basis.up.z).toBeCloseTo(0)
    expect(basis.right.x).toBeCloseTo(1)
    expect(basis.right.y).toBeCloseTo(0)
    expect(basis.right.z).toBeCloseTo(0)
  })

  it('falls back to an orthonormal basis when the camera looks straight down', () => {
    const basis = rollBasis(TARGET, { x: 0, y: 5, z: 0 })

    expect(basis.right.x).toBeCloseTo(1)
    expect(basis.right.length()).toBeCloseTo(1)
    expect(basis.up.length()).toBeCloseTo(1)
    expect(basis.up.dot(basis.right)).toBeCloseTo(0)
    expect(basis.up.dot(basis.backward)).toBeCloseTo(0)
    expect(basis.up.z).toBeCloseTo(-1)
  })

  it('falls back to an orthonormal basis when the camera looks straight up', () => {
    const basis = rollBasis(TARGET, { x: 0, y: -5, z: 0 })

    expect(basis.right.x).toBeCloseTo(1)
    expect(basis.right.length()).toBeCloseTo(1)
    expect(basis.up.length()).toBeCloseTo(1)
    expect(basis.up.dot(basis.right)).toBeCloseTo(0)
    expect(basis.up.dot(basis.backward)).toBeCloseTo(0)
    expect(basis.up.z).toBeCloseTo(1)
  })

  it('orients (up, right) tangent to the camera ray for an oblique view', () => {
    const basis = rollBasis(TARGET, { x: 3, y: 4, z: 0 })

    expect(basis.right.z).toBeCloseTo(-1)
    expect(basis.up.dot(basis.right)).toBeCloseTo(0)
    expect(basis.up.dot(basis.backward)).toBeCloseTo(0)
  })

  it('returns a valid orthonormal basis when the camera sits on the target', () => {
    const basis = rollBasis(TARGET, { x: 0, y: 0, z: 0 })

    expect(basis.backward.length()).toBeCloseTo(1)
    expect(basis.right.length()).toBeCloseTo(1)
    expect(basis.up.length()).toBeCloseTo(1)
    expect(basis.up.dot(basis.right)).toBeCloseTo(0)
    expect(basis.up.dot(basis.backward)).toBeCloseTo(0)
    expect(basis.right.dot(basis.backward)).toBeCloseTo(0)
  })
})

describe('pointToRollAngle', () => {
  const CAMERA = { x: 0, y: 0, z: 5 }

  it('returns 0 when the point sits in the +up direction', () => {
    expect(pointToRollAngle({ x: 0, y: 1, z: 0 }, TARGET, CAMERA)).toBeCloseTo(
      0
    )
  })

  it('returns +90 when the point sits in the +right direction', () => {
    expect(pointToRollAngle({ x: 1, y: 0, z: 0 }, TARGET, CAMERA)).toBeCloseTo(
      90
    )
  })

  it('returns -90 when the point sits in the -right direction', () => {
    expect(pointToRollAngle({ x: -1, y: 0, z: 0 }, TARGET, CAMERA)).toBeCloseTo(
      -90
    )
  })

  it('returns 180 (or -180) when the point sits in the -up direction', () => {
    expect(
      Math.abs(pointToRollAngle({ x: 0, y: -1, z: 0 }, TARGET, CAMERA))
    ).toBeCloseTo(180)
  })

  it('is invariant to the off-plane component of the point', () => {
    const base = pointToRollAngle({ x: 1, y: 1, z: 0 }, TARGET, CAMERA)
    const offPlane = pointToRollAngle({ x: 1, y: 1, z: 7 }, TARGET, CAMERA)
    expect(offPlane).toBeCloseTo(base)
  })
})
