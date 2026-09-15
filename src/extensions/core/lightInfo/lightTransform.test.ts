import { describe, expect, it } from 'vitest'

import { orbitAnglesFor, orbitPosition } from './lightTransform'

describe('orbitPosition', () => {
  it('places zero yaw / zero pitch on +Z at the given distance', () => {
    const pos = orbitPosition({ x: 0, y: 0, z: 0 }, 0, 0, 5)
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(0)
    expect(pos.z).toBeCloseTo(5)
  })

  it('is offset by the target', () => {
    const pos = orbitPosition({ x: 1, y: 2, z: 3 }, 0, 90, 4)
    expect(pos.x).toBeCloseTo(1)
    expect(pos.y).toBeCloseTo(6)
    expect(pos.z).toBeCloseTo(3)
  })

  it('rotates around Y with yaw', () => {
    const pos = orbitPosition({ x: 0, y: 0, z: 0 }, 90, 0, 2)
    expect(pos.x).toBeCloseTo(2)
    expect(pos.z).toBeCloseTo(0)
  })
})

describe('orbitAnglesFor', () => {
  it('is the inverse of orbitPosition', () => {
    const target = { x: 1, y: -0.5, z: 2 }
    const pos = orbitPosition(target, 40, 30, 7)
    const angles = orbitAnglesFor(pos, target)
    expect(angles.yaw).toBeCloseTo(40)
    expect(angles.pitch).toBeCloseTo(30)
    expect(angles.distance).toBeCloseTo(7)
  })

  it('clamps degenerate zero-distance input to a tiny distance', () => {
    const angles = orbitAnglesFor({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    expect(angles.distance).toBeGreaterThan(0)
  })
})
