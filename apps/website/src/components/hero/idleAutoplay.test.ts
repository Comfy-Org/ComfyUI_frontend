import { describe, expect, it } from 'vitest'

import type { AutoplayState } from './idleAutoplay'
import { advanceAutoplay } from './idleAutoplay'

const START: AutoplayState = {
  phase: 0,
  azimuth: 0,
  elevation: 0,
  zoom: 5,
  hue: 0,
  saturation: 1
}

function run(from: AutoplayState, seconds: number, dt: number): AutoplayState {
  let state = from
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    state = advanceAutoplay(state, dt)
  }
  return state
}

describe('advanceAutoplay', () => {
  it('keeps the continuously cycling values inside a single turn', () => {
    const state = run(START, 120, 1 / 60)
    expect(state.azimuth).toBeGreaterThanOrEqual(0)
    expect(state.azimuth).toBeLessThan(360)
    expect(state.hue).toBeGreaterThanOrEqual(0)
    expect(state.hue).toBeLessThan(360)
  })

  it('advances the cycling values at the same rate regardless of frame rate', () => {
    const smooth = run(START, 10, 1 / 120)
    const choppy = run(START, 10, 1 / 15)
    expect(smooth.azimuth).toBeCloseTo(choppy.azimuth, 6)
    expect(smooth.hue).toBeCloseTo(choppy.hue, 6)
  })

  it('holds the eased values within the range their clamps accept', () => {
    let state = START
    for (let i = 0; i < 60 * 120; i++) {
      state = advanceAutoplay(state, 1 / 60)
      expect(state.elevation).toBeGreaterThanOrEqual(-30)
      expect(state.elevation).toBeLessThanOrEqual(60)
      expect(state.zoom).toBeGreaterThanOrEqual(0)
      expect(state.zoom).toBeLessThanOrEqual(10)
      expect(state.saturation).toBeGreaterThanOrEqual(0)
      expect(state.saturation).toBeLessThanOrEqual(2)
    }
  })

  it('eases out of a pose the visitor left rather than snapping to the wave', () => {
    const handover: AutoplayState = { ...START, elevation: 60, zoom: 0 }
    const next = advanceAutoplay(handover, 1 / 60)
    expect(next.elevation).toBeLessThan(60)
    expect(next.elevation).toBeGreaterThan(55)
    expect(next.zoom).toBeGreaterThan(0)
    expect(next.zoom).toBeLessThan(1)
  })

  it('sweeps the camera through a full orbit and back through every height', () => {
    let state = START
    const azimuths = new Set<number>()
    let lowest = Infinity
    let highest = -Infinity
    for (let i = 0; i < 60 * 60; i++) {
      state = advanceAutoplay(state, 1 / 60)
      azimuths.add(Math.floor(state.azimuth / 45))
      lowest = Math.min(lowest, state.elevation)
      highest = Math.max(highest, state.elevation)
    }
    expect(azimuths.size).toBe(8)
    expect(lowest).toBeLessThan(-15)
    expect(highest).toBeGreaterThan(45)
  })
})
