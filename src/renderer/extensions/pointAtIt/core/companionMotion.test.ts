import { describe, expect, it } from 'vitest'

import { stepToward } from './companionMotion'
import type { Point } from './geometry'

const FRAME_MS = 16

describe('stepToward', () => {
  const from: Point = { x: 0, y: 0 }
  const goal: Point = { x: 300, y: 100 }

  it('CP-06: moves part of the way each frame and lands exactly on the goal', () => {
    let position = from
    const seen: Point[] = []
    for (let elapsed = 0; elapsed < 2000; elapsed += FRAME_MS) {
      position = stepToward(position, goal, FRAME_MS).position
      seen.push(position)
    }

    const xs = seen.map((point) => point.x)
    expect(xs[0]).toBeGreaterThan(0)
    expect(xs[0]).toBeLessThan(goal.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(position).toEqual(goal)
  })

  it('CP-06: covers the same ground in the same time whatever the frame rate', () => {
    const oneFrame = stepToward(from, goal, 32).position
    const twoFrames = stepToward(
      stepToward(from, goal, 16).position,
      goal,
      16
    ).position

    expect(oneFrame.x).toBeCloseTo(twoFrames.x)
    expect(oneFrame.y).toBeCloseTo(twoFrames.y)
  })

  it('CP-06: is travelling while far from the goal, and has landed once it is near', () => {
    expect(stepToward(from, goal, FRAME_MS).travelling).toBe(true)
    expect(stepToward({ x: 290, y: 100 }, goal, FRAME_MS).travelling).toBe(
      false
    )
  })

  it('CP-09: is not travelling while it only trails a goal that moves a little', () => {
    const trailing = stepToward({ x: 300, y: 80 }, goal, FRAME_MS)

    expect(trailing.travelling).toBe(false)
    expect(trailing.position.y).toBeGreaterThan(80)
    expect(trailing.position.y).toBeLessThan(100)
  })

  it('stays put when it is already on the goal', () => {
    expect(stepToward(goal, goal, FRAME_MS)).toEqual({
      position: goal,
      travelling: false
    })
  })
})
