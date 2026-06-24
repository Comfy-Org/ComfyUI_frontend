import { describe, expect, it } from 'vitest'

import type { NodeId, Rect } from './heroGraphWires'
import { computeWires, connections, spline } from './heroGraphWires'

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
    // A short rightward run with a large vertical rise: must still leave/enter
    // along x so it reads left-to-right, not as a top-down drop.
    const { sx, sy, c1x, c1y, c2x, c2y, ex, ey } = controlPoints(
      spline({ x: 0, y: 200 }, { x: 120, y: 0 }, 'h')
    )
    expect(c1y).toBe(sy)
    expect(c2y).toBe(ey)
    expect(c1x).toBeGreaterThan(sx)
    expect(c2x).toBeLessThan(ex)
  })

  it('departs and arrives vertically for stacked ports', () => {
    const { sx, sy, c1x, c1y, c2x, c2y, ex, ey } = controlPoints(
      spline({ x: 100, y: 0 }, { x: 140, y: 400 }, 'v')
    )
    expect(c1x).toBe(sx)
    expect(c2x).toBe(ex)
    expect(c1y).toBeGreaterThan(sy)
    expect(c2y).toBeLessThan(ey)
  })
})

describe('connections', () => {
  it('feeds the color remixer from texture, not directly from image', () => {
    const pairs = connections.map((c) => `${c.from}->${c.to}`)
    expect(pairs).toContain('texture->color')
    expect(pairs).not.toContain('image->color')
  })

  it('chains image → texture → color → lighting → output', () => {
    expect(connections.map((c) => `${c.from}->${c.to}`)).toEqual([
      'image->texture',
      'texture->color',
      'color->lighting',
      'lighting->output'
    ])
  })
})

describe('computeWires', () => {
  const anchors: Record<NodeId, Rect> = {
    image: { x: 60, y: 28, w: 300, h: 395 },
    texture: { x: 96, y: 500, w: 200, h: 225 },
    color: { x: 470, y: 470, w: 150, h: 180 },
    lighting: { x: 720, y: 500, w: 168, h: 179 },
    output: { x: 1000, y: 110, w: 760, h: 611 }
  }

  it('only emits wires for nodes that have been measured', () => {
    expect(computeWires({ image: anchors.image }).length).toBe(0)
    expect(computeWires(anchors).length).toBe(connections.length)
  })

  it('marks the image → texture wire as the accent wire', () => {
    const wires = computeWires(anchors)
    expect(wires[0].accent).toBe(true)
    expect(wires.slice(1).every((w) => !w.accent)).toBe(true)
  })
})
