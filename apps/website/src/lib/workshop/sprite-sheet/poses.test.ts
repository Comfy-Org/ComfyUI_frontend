import { describe, expect, it } from 'vitest'

import { SPRITE_MOTIONS } from './options'
import { framePose, poseTransform, seededUnit } from './poses'

describe('framePose', () => {
  it.for(SPRITE_MOTIONS)(
    'draws the same %s again for the same seed',
    (motion) => {
      expect(framePose(motion, 3, 8, 7)).toEqual(framePose(motion, 3, 8, 7))
    }
  )

  it.for(SPRITE_MOTIONS)(
    'loops %s: the frame after the last is the first',
    (motion) => {
      expect(framePose(motion, 8, 8, 7)).toEqual(framePose(motion, 0, 8, 7))
    }
  )

  it('lifts a jump off the ground mid-loop and lands it squashed', () => {
    const takeoff = framePose('jump', 0, 8, 1)
    const peak = framePose('jump', 4, 8, 1)
    expect(takeoff.lift).toBe(0)
    expect(takeoff.squash).toBeGreaterThan(0)
    expect(peak.lift).toBeGreaterThan(0.15)
    expect(peak.shadow).toBeLessThan(takeoff.shadow)
  })

  it('steps a walk on alternate feet', () => {
    const strides = Array.from(
      { length: 8 },
      (_, index) => framePose('walk', index, 8, 3).stride
    )
    expect(Math.max(...strides)).toBeGreaterThan(0)
    expect(Math.min(...strides)).toBeLessThan(0)
  })

  it('keeps an idle character on the spot, only breathing', () => {
    const poses = Array.from({ length: 8 }, (_, index) =>
      framePose('idle', index, 8, 3)
    )
    expect(poses.every((pose) => pose.shift === 0 && pose.stride === 0)).toBe(
      true
    )
    expect(Math.max(...poses.map((pose) => pose.lift))).toBeLessThan(0.06)
  })

  it('gives another seed another take of the motion', () => {
    expect(framePose('walk', 1, 8, 1)).not.toEqual(framePose('walk', 1, 8, 2))
  })
})

describe('seededUnit', () => {
  it('stays within [0, 1)', () => {
    const values = Array.from({ length: 200 }, (_, seed) => seededUnit(seed, 1))
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
  })
})

describe('poseTransform', () => {
  it('raises, turns and squashes the character', () => {
    expect(
      poseTransform({
        lift: 0.1,
        shift: 0.02,
        tilt: 4,
        squash: 0.05,
        stride: 0,
        shadow: 1
      })
    ).toBe('translate(2%, -10%) rotate(4deg) scale(1.05, 0.95)')
  })
})
