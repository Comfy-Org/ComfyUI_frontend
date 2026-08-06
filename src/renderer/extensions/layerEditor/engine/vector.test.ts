import { describe, expect, it } from 'vitest'

import {
  ELLIPSE_KAPPA,
  arcPath,
  clonePath,
  ellipsePath,
  flatten,
  flattenStroke,
  linePath,
  pathBounds,
  polygonPath,
  rectPath,
  spiralPath,
  starPath,
  strokeFromTriples,
  strokeSegments,
  transformPath
} from './vector'

describe('shape constructors', () => {
  it('rectPath builds one closed stroke of 4 anchors with degenerate handles', () => {
    const path = rectPath(10, 20, 100, 50)
    expect(path.strokes).toHaveLength(1)
    const s = path.strokes[0]
    expect(s.closed).toBe(true)
    expect(s.anchors).toHaveLength(12)
    const anchors = s.anchors
      .filter((a) => a.type === 'anchor')
      .map((a) => a.pos)
    expect(anchors).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 }
    ])
    for (let i = 0; i < 4; i++) {
      expect(s.anchors[i * 3].pos).toEqual(s.anchors[i * 3 + 1].pos)
      expect(s.anchors[i * 3 + 2].pos).toEqual(s.anchors[i * 3 + 1].pos)
    }
  })

  it('ellipsePath uses the GIMP kappa handle offset', () => {
    expect(ELLIPSE_KAPPA).toBeCloseTo(0.5522847, 6)
    const path = ellipsePath(50, 50, 40, 20)
    const s = path.strokes[0]
    expect(s.closed).toBe(true)
    expect(s.anchors).toHaveLength(12)
    expect(s.anchors[1].pos).toEqual({ x: 50, y: 30 })
    expect(s.anchors[2].pos.x).toBeCloseTo(50 + ELLIPSE_KAPPA * 40, 6)
    expect(s.anchors[4].pos).toEqual({ x: 90, y: 50 })
    expect(s.anchors[3].pos.y).toBeCloseTo(50 - ELLIPSE_KAPPA * 20, 6)
  })

  it('ellipse flattening stays on the ellipse within ~0.2% radius error', () => {
    const path = ellipsePath(0, 0, 100, 100)
    const pts = flattenStroke(path.strokes[0], 32)
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(99.7)
      expect(Math.hypot(p.x, p.y)).toBeLessThan(100.3)
    }
  })

  it('linePath is a single open segment', () => {
    const path = linePath(0, 0, 10, 5)
    const s = path.strokes[0]
    expect(s.closed).toBe(false)
    const segs = strokeSegments(s)
    expect(segs).toHaveLength(1)
    expect(segs[0].from).toEqual({ x: 0, y: 0 })
    expect(segs[0].to).toEqual({ x: 10, y: 5 })
  })
})

describe('parametric shape constructors', () => {
  it('polygonPath places n vertices on the circle, clamping below 3 sides', () => {
    const path = polygonPath(0, 0, 10, 4, 0)
    const anchors = path.strokes[0].anchors.filter((a) => a.type === 'anchor')
    expect(anchors).toHaveLength(4)
    expect(anchors[0].pos.x).toBeCloseTo(10, 6)
    for (const a of anchors) {
      expect(Math.hypot(a.pos.x, a.pos.y)).toBeCloseTo(10, 6)
    }
    const clamped = polygonPath(0, 0, 10, 1, 0)
    expect(
      clamped.strokes[0].anchors.filter((a) => a.type === 'anchor')
    ).toHaveLength(3)
  })

  it('starPath alternates outer and inner radii', () => {
    const path = starPath(0, 0, 10, 4, 5, 0)
    const anchors = path.strokes[0].anchors.filter((a) => a.type === 'anchor')
    expect(anchors).toHaveLength(10)
    const radii = anchors.map((a) => Math.hypot(a.pos.x, a.pos.y))
    for (let i = 0; i < radii.length; i++) {
      expect(radii[i]).toBeCloseTo(i % 2 === 0 ? 10 : 4, 6)
    }
  })

  it('arcPath draws a half circle over the chord and rejects zero chords', () => {
    const path = arcPath(0, 0, 10, 0)
    const s = path.strokes[0]
    expect(s.closed).toBe(false)
    const pts = flattenStroke(s, 16)
    for (const p of pts) {
      expect(Math.hypot(p.x - 5, p.y)).toBeCloseTo(5, 1)
    }
    expect(arcPath(3, 3, 3, 3).strokes).toEqual([])
  })

  it('spiralPath grows radius from the centre to r at the end angle', () => {
    const path = spiralPath(0, 0, 20, 2, 0)
    const anchors = path.strokes[0].anchors.filter((a) => a.type === 'anchor')
    expect(anchors[0].pos).toEqual({ x: 0, y: 0 })
    const end = anchors[anchors.length - 1].pos
    expect(Math.hypot(end.x, end.y)).toBeCloseTo(20, 6)
    expect(path.strokes[0].closed).toBe(false)
  })

  it('strokeFromTriples builds control/anchor/control runs', () => {
    const s = strokeFromTriples(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ],
      false
    )
    expect(s.anchors.map((a) => a.type)).toEqual([
      'control',
      'anchor',
      'control'
    ])
    expect(s.anchors[1].pos).toEqual({ x: 1, y: 1 })
  })
})

describe('flatten', () => {
  it('flattens every stroke of a path', () => {
    const path = rectPath(0, 0, 10, 10)
    path.strokes.push(linePath(0, 0, 5, 5).strokes[0])
    const polys = flatten(path, 4)
    expect(polys).toHaveLength(2)
    expect(polys[0].length).toBeGreaterThan(4)
  })

  it('falls back to raw anchors for degenerate strokes', () => {
    const s = strokeFromTriples(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ],
      false
    )
    expect(flattenStroke(s)).toEqual([{ x: 1, y: 1 }])
  })
})

describe('strokeSegments', () => {
  it('open strokes do not wrap around', () => {
    const path = linePath(0, 0, 10, 0)
    expect(strokeSegments(path.strokes[0])).toHaveLength(1)
  })

  it('closed strokes emit one segment per anchor', () => {
    const path = rectPath(0, 0, 10, 10)
    expect(strokeSegments(path.strokes[0])).toHaveLength(4)
  })

  it('rejects malformed anchor counts', () => {
    const s = rectPath(0, 0, 10, 10).strokes[0]
    s.anchors = s.anchors.slice(0, 5)
    expect(strokeSegments(s)).toEqual([])
  })
})

describe('pathBounds', () => {
  it('inflates by half the stroke width and floors/ceils', () => {
    const path = rectPath(10, 10, 100, 50)
    expect(pathBounds(path, 0)).toEqual({ x: 10, y: 10, w: 100, h: 50 })
    expect(pathBounds(path, 8)).toEqual({ x: 6, y: 6, w: 108, h: 58 })
  })

  it('returns null for an empty path', () => {
    expect(pathBounds({ strokes: [] })).toBeNull()
  })
})

describe('transformPath / clonePath', () => {
  it('maps every anchor and keeps the source untouched', () => {
    const path = rectPath(0, 0, 10, 10)
    const moved = transformPath(path, (p) => ({ x: p.x + 5, y: p.y - 3 }))
    expect(moved.strokes[0].anchors[1].pos).toEqual({ x: 5, y: -3 })
    expect(path.strokes[0].anchors[1].pos).toEqual({ x: 0, y: 0 })
  })

  it('clonePath deep-copies anchors', () => {
    const path = rectPath(0, 0, 10, 10)
    const copy = clonePath(path)
    copy.strokes[0].anchors[1].pos.x = 999
    expect(path.strokes[0].anchors[1].pos.x).toBe(0)
  })
})
