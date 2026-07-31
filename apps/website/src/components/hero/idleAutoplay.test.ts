import { describe, expect, it } from 'vitest'

import type { AutoplayState } from './idleAutoplay'
import {
  LEG_COUNT,
  advanceAutoplay,
  isAutoplayDone,
  startAutoplay
} from './idleAutoplay'

const DEFAULT_POSE = {
  azimuth: 0,
  elevation: 0,
  zoom: 5,
  hue: 0,
  saturation: 1
}

const LEG_SECONDS = 2.5
const TOUR_SECONDS = LEG_COUNT * LEG_SECONDS

function run(from: AutoplayState, seconds: number, dt: number): AutoplayState {
  let state = from
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    state = advanceAutoplay(state, dt)
  }
  return state
}

describe('advanceAutoplay', () => {
  it('advances at the same rate regardless of frame rate', () => {
    // Leg boundaries quantise to the frame grid, so a coarse step may trail a
    // fine one by up to one coarse frame of travel — but never diverge.
    const smooth = run(startAutoplay(DEFAULT_POSE), 10.4, 1 / 120)
    const choppy = run(startAutoplay(DEFAULT_POSE), 10.4, 1 / 15)
    expect(smooth.legIndex).toBe(choppy.legIndex)
    expect(Math.abs(smooth.azimuth - choppy.azimuth)).toBeLessThan(5)
    expect(Math.abs(smooth.elevation - choppy.elevation)).toBeLessThan(5)
    expect(Math.abs(smooth.hue - choppy.hue)).toBeLessThan(5)
  })

  it('settles each leg onto an exactly shipped pose', () => {
    let state = startAutoplay(DEFAULT_POSE)
    for (let leg = 0; leg < 4; leg++) {
      state = run(state, LEG_SECONDS, 1 / 60)
      const offBucket =
        Math.abs(state.azimuth / 45 - Math.round(state.azimuth / 45)) * 45
      expect(offBucket).toBeLessThan(1)
      const nearRing =
        Math.abs(state.elevation) < 1 || Math.abs(state.elevation - 30) < 1
      expect(nearRing).toBe(true)
      expect(state.zoom).toBeCloseTo(4, 0)
    }
  })

  it('holds nearly still at the end of a leg before moving again', () => {
    // 2.0s into a 2.5s leg the travel window is over; the pose barely moves.
    const settled = run(startAutoplay(DEFAULT_POSE), 2.0, 1 / 60)
    const held = run(settled, 0.4, 1 / 60)
    expect(Math.abs(held.azimuth - settled.azimuth)).toBeLessThan(1)
    expect(Math.abs(held.elevation - settled.elevation)).toBeLessThan(1)
    // ...then the next leg pulls it a full azimuth step onward.
    const moved = run(held, LEG_SECONDS, 1 / 60)
    expect(moved.azimuth - held.azimuth).toBeGreaterThan(30)
  })

  it('eases out of a pose the visitor left rather than snapping', () => {
    const handover = startAutoplay({ ...DEFAULT_POSE, elevation: 60, zoom: 0 })
    const next = advanceAutoplay(handover, 1 / 60)
    expect(next.elevation).toBeLessThan(60)
    expect(next.elevation).toBeGreaterThan(55)
    expect(next.zoom).toBeGreaterThan(0)
    expect(next.zoom).toBeLessThan(1)
  })

  it('keeps every value inside the range its clamp accepts', () => {
    let state = startAutoplay(DEFAULT_POSE)
    for (let i = 0; i < 60 * 30; i++) {
      state = advanceAutoplay(state, 1 / 60)
      expect(state.elevation).toBeGreaterThanOrEqual(-30)
      expect(state.elevation).toBeLessThanOrEqual(60)
      expect(state.zoom).toBeGreaterThanOrEqual(0)
      expect(state.zoom).toBeLessThanOrEqual(10)
      expect(state.saturation).toBeGreaterThanOrEqual(0)
      expect(state.saturation).toBeLessThanOrEqual(2)
    }
  })

  it('orbits through every azimuth bucket over the tour', () => {
    let state = startAutoplay(DEFAULT_POSE)
    const buckets = new Set<number>()
    for (let i = 0; i < 60 * TOUR_SECONDS; i++) {
      state = advanceAutoplay(state, 1 / 60)
      buckets.add(Math.round((((state.azimuth % 360) + 360) % 360) / 45) % 8)
    }
    expect(buckets.size).toBe(8)
  })

  it('completes after one full orbit, landing exactly on the starting pose', () => {
    const start = { ...DEFAULT_POSE, hue: 20, saturation: 1 }
    const done = run(startAutoplay(start), TOUR_SECONDS + 0.1, 1 / 60)
    expect(isAutoplayDone(done)).toBe(true)
    expect(done.azimuth).toBe(start.azimuth + 360)
    expect(done.elevation).toBe(start.elevation)
    expect(done.zoom).toBe(start.zoom)
    expect(done.hue).toBe(start.hue + 360)
    expect(done.saturation).toBe(start.saturation)
  })

  it('stays pinned once the tour is complete', () => {
    const done = run(startAutoplay(DEFAULT_POSE), TOUR_SECONDS + 0.1, 1 / 60)
    const later = run(done, 10, 1 / 60)
    expect(later.legIndex).toBe(done.legIndex)
    expect(later.azimuth).toBe(done.azimuth)
    expect(later.elevation).toBe(done.elevation)
    expect(later.zoom).toBe(done.zoom)
    expect(later.hue).toBe(done.hue)
    expect(later.saturation).toBe(done.saturation)
  })
})
