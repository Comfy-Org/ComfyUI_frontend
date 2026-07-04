import { describe, expect, it } from 'vitest'

import {
  NODE_W,
  STAGE_H,
  STAGE_W,
  clampNodePosition,
  homePositions
} from './heroGraphLayout'

describe('clampNodePosition', () => {
  it('leaves positions inside the stage untouched', () => {
    expect(clampNodePosition('color', { x: 400, y: 300 }, 180)).toEqual({
      x: 400,
      y: 300
    })
  })

  it('stops nodes at the stage edges instead of letting them escape', () => {
    expect(clampNodePosition('color', { x: -80, y: -50 }, 180)).toEqual({
      x: 0,
      y: 0
    })
    expect(clampNodePosition('color', { x: 5000, y: 5000 }, 180)).toEqual({
      x: STAGE_W - NODE_W.color,
      y: STAGE_H - 180
    })
  })

  it('keeps the node bottom above the stage floor so it never gets cut off', () => {
    const height = 620
    const { y } = clampNodePosition('output', { x: 956, y: 700 }, height)
    expect(y + height).toBeLessThanOrEqual(STAGE_H)
  })

  it('lets the OUTPUT keep its home right-edge bleed but not exceed it', () => {
    const home = homePositions.output
    expect(home.x + NODE_W.output).toBeGreaterThan(STAGE_W)
    expect(clampNodePosition('output', home, 620)).toEqual(home)
    expect(clampNodePosition('output', { x: 1400, y: home.y }, 620).x).toBe(
      home.x
    )
  })

  it('accepts every home position unchanged', () => {
    for (const [id, home] of Object.entries(homePositions)) {
      expect(
        clampNodePosition(id as keyof typeof homePositions, home, 100)
      ).toEqual(home)
    }
  })
})
