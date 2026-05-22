import { describe, expect, it } from 'vitest'

import type { GestureState } from './interpretGesture'
import { interpretGesture } from './interpretGesture'

function baseState(overrides: Partial<GestureState> = {}): GestureState {
  return {
    dirAvg: [1, 0],
    speedMult: 1,
    baseSpeed: 1,
    ...overrides
  }
}

describe('interpretGesture', () => {
  it('pure horizontal drag → all delta becomes value change, sensitivity unchanged', () => {
    const r = interpretGesture(baseState(), 10, 0)
    expect(r.weight).toBe(1)
    expect(r.valueDelta).toBe(10)
    expect(r.speedMultNext).toBe(1)
  })

  it('pure vertical drag → no value change, sensitivity scales by 0.98^dy', () => {
    const r = interpretGesture(baseState({ dirAvg: [0, 1] }), 0, 10)
    expect(r.weight).toBe(0)
    expect(r.valueDelta).toBe(0)
    expect(r.speedMultNext).toBeCloseTo(Math.pow(0.98, 10), 10)
  })

  it('zero delta is a no-op for value and sensitivity', () => {
    const r = interpretGesture(baseState(), 0, 0)
    expect(r.valueDelta).toBe(0)
    expect(r.speedMultNext).toBe(1)
  })

  it('respects modifierSpeed', () => {
    const r = interpretGesture(baseState({ modifierSpeed: 10 }), 5, 0)
    expect(r.valueDelta).toBe(50)
  })

  it('clamps speedMult to [minSpeed, maxSpeed]', () => {
    const veryFast = interpretGesture(
      baseState({ dirAvg: [0, 1], speedMult: 0.5, minSpeed: 0.1, maxSpeed: 1 }),
      0,
      -1000
    )
    expect(veryFast.speedMultNext).toBe(1)

    const verySlow = interpretGesture(
      baseState({ dirAvg: [0, 1], speedMult: 0.5, minSpeed: 0.1, maxSpeed: 1 }),
      0,
      1000
    )
    expect(verySlow.speedMultNext).toBe(0.1)
  })

  it('diagonal drag blends value and sensitivity proportionally', () => {
    // Slightly-vertical-leaning dirAvg with small deltas → normalized x
    // component lands in the smoothstep transition zone (0.4..0.6).
    const r = interpretGesture(baseState({ dirAvg: [0.5, 0.866] }), 1, 2)
    expect(r.weight).toBeGreaterThan(0)
    expect(r.weight).toBeLessThan(1)
    expect(r.valueDelta).toBeGreaterThan(0)
    expect(r.valueDelta).toBeLessThan(1)
    expect(r.speedMultNext).toBeLessThan(1)
  })

  it('dirAvgNext is normalized (unit length)', () => {
    const r = interpretGesture(baseState(), 7, 13)
    expect(Math.hypot(...r.dirAvgNext)).toBeCloseTo(1, 10)
  })

  it('is deterministic — same inputs produce same outputs', () => {
    const a = interpretGesture(baseState({ speedMult: 0.3 }), 4, -2)
    const b = interpretGesture(baseState({ speedMult: 0.3 }), 4, -2)
    expect(a).toEqual(b)
  })
})
