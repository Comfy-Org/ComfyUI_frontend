import { describe, expect, it } from 'vitest'

import type { Rect, WorkflowNodeId } from './heroWorkflowGraph'
import {
  NODE_W,
  STAGE_H,
  STAGE_W,
  clampNodePosition,
  computeWires,
  connections,
  homePositions,
  spline
} from './heroWorkflowGraph'

// Cubic command shape: "M sx sy C c1x c1y c2x c2y ex ey"
function controlPoints(d: string) {
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = d
    .replace(/[MC]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
  return { sx, sy, c1x, c1y, c2x, c2y, ex, ey }
}

describe('spline', () => {
  it('departs and arrives horizontally for side ports even when the vertical gap dominates', () => {
    const { sx, sy, c1x, c1y, c2x, c2y, ex, ey } = controlPoints(
      spline({ x: 0, y: 200 }, { x: 120, y: 0 }, 'h')
    )
    expect(c1y).toBe(sy)
    expect(c2y).toBe(ey)
    expect(c1x).toBeGreaterThan(sx)
    expect(c2x).toBeLessThan(ex)
  })
})

describe('computeWires', () => {
  const anchors = Object.fromEntries(
    (Object.keys(homePositions) as WorkflowNodeId[]).map((id) => [
      id,
      { ...homePositions[id], w: NODE_W[id], h: 120 } satisfies Rect
    ])
  ) as Record<WorkflowNodeId, Rect>

  it('produces one wire per connection with endpoints on the node edges', () => {
    const wires = computeWires(anchors)
    expect(wires).toHaveLength(connections.length)
    for (const [i, wire] of wires.entries()) {
      const from = anchors[connections[i].from]
      const to = anchors[connections[i].to]
      expect(wire.from.x).toBe(from.x + from.w)
      expect(wire.to.x).toBe(to.x)
    }
  })

  it('skips wires whose endpoints are not yet measured', () => {
    const { model, lora } = anchors
    expect(computeWires({ model, lora })).toHaveLength(1)
  })
})

describe('clampNodePosition', () => {
  it('keeps nodes fully inside the stage', () => {
    const clamped = clampNodePosition('output', { x: 5000, y: -50 }, 560)
    expect(clamped).toEqual({ x: STAGE_W - NODE_W.output, y: 0 })
    expect(clampNodePosition('seed', { x: 100, y: 9999 }, 120).y).toBe(
      STAGE_H - 120
    )
  })
})
