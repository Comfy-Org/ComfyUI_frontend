import { describe, expect, it } from 'vitest'
import { applySnap, buildSnapTargets, nearestTarget } from './snapping'

const OPTS = { thrX: 0.02, thrY: 0.02, minWH: 0.02 }

describe('buildSnapTargets', () => {
  it('always includes stage edges + center', () => {
    const t = buildSnapTargets([])
    expect(t.xs).toEqual([0, 0.5, 1])
    expect(t.ys).toEqual([0, 0.5, 1])
  })
  it('scales stage targets to explicit bounds', () => {
    const t = buildSnapTargets([], { w: 200, h: 100 })
    expect(t.xs).toEqual([0, 100, 200])
    expect(t.ys).toEqual([0, 50, 100])
  })
  it("adds each element's left/center/right and top/center/bottom", () => {
    const t = buildSnapTargets([{ x: 0.2, y: 0.4, w: 0.2, h: 0.2 }])
    const near = (arr: number[], v: number) =>
      arr.some((x) => Math.abs(x - v) < 1e-9)
    expect(near(t.xs, 0.2)).toBe(true)
    expect(near(t.xs, 0.3)).toBe(true)
    expect(near(t.xs, 0.4)).toBe(true)
    expect(near(t.ys, 0.5)).toBe(true)
  })
})

describe('nearestTarget', () => {
  it('returns nearest within threshold', () => {
    expect(nearestTarget(0.505, [0, 0.5, 1], 0.02)).toBe(0.5)
  })
  it('returns null outside threshold', () => {
    expect(nearestTarget(0.7, [0, 0.5, 1], 0.02)).toBeNull()
  })
})

describe('applySnap move', () => {
  it('snaps left edge to the stage left and records a guide', () => {
    const { rect, guides } = applySnap(
      'move',
      { x: 0.008, y: 0.3, w: 0.2, h: 0.2 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.x).toBeCloseTo(0, 6)
    expect(guides).toContainEqual({ axis: 'x', pos: 0, kind: 'edge' })
  })
  it('snaps center to stage center', () => {
    const { rect } = applySnap(
      'move',
      { x: 0.395, y: 0.395, w: 0.2, h: 0.2 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.x).toBeCloseTo(0.4, 6)
    expect(rect.y).toBeCloseTo(0.4, 6)
  })
  it('does not move when nothing is within threshold', () => {
    const r = { x: 0.234, y: 0.567, w: 0.1, h: 0.1 }
    const { rect, guides } = applySnap(
      'move',
      { ...r },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect).toEqual(r)
    expect(guides).toHaveLength(0)
  })
  it('records only an x guide when y has no nearby target', () => {
    const { guides } = applySnap(
      'move',
      { x: 0.008, y: 0.234, w: 0.1, h: 0.1 },
      buildSnapTargets([]),
      OPTS
    )
    expect(guides).toEqual([{ axis: 'x', pos: 0, kind: 'edge' }])
  })
  it('works in pixel bounds', () => {
    const targets = buildSnapTargets([{ x: 100, y: 0, w: 50, h: 50 }], {
      w: 800,
      h: 600
    })
    const { rect, guides } = applySnap(
      'move',
      { x: 148, y: 200, w: 60, h: 40 },
      targets,
      { thrX: 6, thrY: 6, minWH: 1, boundsW: 800, boundsH: 600 }
    )
    expect(rect.x).toBe(150)
    expect(guides).toContainEqual({ axis: 'x', pos: 150, kind: 'edge' })
  })
  it('clamp:false allows leaving the canvas', () => {
    const { rect } = applySnap(
      'move',
      { x: -50, y: -20, w: 60, h: 40 },
      { xs: [], ys: [] },
      { thrX: 6, thrY: 6, minWH: 1, boundsW: 800, boundsH: 600, clamp: false }
    )
    expect(rect.x).toBe(-50)
    expect(rect.y).toBe(-20)
  })
})

describe('grid and guide targets', () => {
  it('adds grid multiples within bounds', () => {
    const t = buildSnapTargets([], { w: 100, h: 100 }, { gridX: 25 })
    for (const v of [0, 25, 50, 75, 100]) {
      expect(t.xs.some((x) => Math.abs(x - v) < 1e-9)).toBe(true)
    }
  })
  it('adds manual guide positions', () => {
    const t = buildSnapTargets(
      [],
      { w: 1, h: 1 },
      { guideXs: [0.33], guideYs: [0.7] }
    )
    expect(t.xs).toContain(0.33)
    expect(t.ys).toContain(0.7)
  })
  it('snaps to a guide during move', () => {
    const t = buildSnapTargets([], undefined, { guideXs: [0.33] })
    const { rect } = applySnap(
      'move',
      { x: 0.325, y: 0.6, w: 0.1, h: 0.1 },
      t,
      OPTS
    )
    expect(rect.x).toBeCloseTo(0.33, 6)
  })
})

describe('equidistance snapping', () => {
  const L = { x: 0, y: 0.4, w: 0.1, h: 0.2 }
  const R = { x: 0.7, y: 0.4, w: 0.1, h: 0.2 }
  it('snaps between two neighbors so gaps equal', () => {
    const moving = { x: 0.335, y: 0.45, w: 0.1, h: 0.1 }
    const { rect, guides } = applySnap(
      'move',
      moving,
      { xs: [], ys: [] },
      { ...OPTS, eqRects: [L, R] }
    )
    expect(rect.x).toBeCloseTo(0.35, 6)
    const g = guides.find((g) => g.kind === 'gap' && g.axis === 'x')
    expect(g).toBeTruthy()
    expect(g!.spans).toHaveLength(2)
    const [s1, s2] = g!.spans!
    expect(s1[1] - s1[0]).toBeCloseTo(s2[1] - s2[0], 6)
  })
  it('continues an existing left-side spacing', () => {
    const A = { x: 0, y: 0.4, w: 0.1, h: 0.2 }
    const B = { x: 0.2, y: 0.4, w: 0.1, h: 0.2 }
    const moving = { x: 0.395, y: 0.45, w: 0.1, h: 0.1 }
    const { rect } = applySnap(
      'move',
      moving,
      { xs: [], ys: [] },
      { ...OPTS, eqRects: [A, B] }
    )
    expect(rect.x).toBeCloseTo(0.4, 6)
  })
  it('ignores neighbors without cross-axis overlap', () => {
    const far = { x: 0, y: 0.9, w: 0.1, h: 0.05 }
    const moving = { x: 0.293, y: 0.1, w: 0.1, h: 0.1 }
    const { guides } = applySnap(
      'move',
      moving,
      { xs: [], ys: [] },
      { ...OPTS, eqRects: [far, { ...R, y: 0.9, h: 0.05 }] }
    )
    expect(guides.filter((g) => g.kind === 'gap')).toHaveLength(0)
  })
  it('edge snap wins when strictly closer', () => {
    const t = buildSnapTargets([], undefined, { guideXs: [0.3495] })
    const moving = { x: 0.348, y: 0.45, w: 0.1, h: 0.1 }
    const { guides } = applySnap('move', moving, t, {
      ...OPTS,
      eqRects: [L, R]
    })
    const gx = guides.find((g) => g.axis === 'x')
    expect(gx?.kind).toBe('edge')
  })
})

describe('applySnap resize', () => {
  it('snaps the east edge to a target width', () => {
    const { rect, guides } = applySnap(
      'e',
      { x: 0.1, y: 0.1, w: 0.395, h: 0.2 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.x).toBeCloseTo(0.1, 6)
    expect(rect.w).toBeCloseTo(0.4, 6)
    expect(guides).toContainEqual({ axis: 'x', pos: 0.5 })
  })
  it('snaps the west edge and keeps the right edge fixed', () => {
    const { rect } = applySnap(
      'w',
      { x: 0.008, y: 0.1, w: 0.4, h: 0.2 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.x).toBeCloseTo(0, 6)
    expect(rect.w).toBeCloseTo(0.408, 6)
  })
  it('enforces a minimum size', () => {
    const { rect } = applySnap(
      'e',
      { x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 },
      { xs: [], ys: [] },
      OPTS
    )
    expect(rect.w).toBeGreaterThanOrEqual(OPTS.minWH)
  })
  it('snaps the north edge keeping the bottom fixed', () => {
    const { rect } = applySnap(
      'n',
      { x: 0.1, y: 0.008, w: 0.2, h: 0.4 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.y).toBeCloseTo(0, 6)
    expect(rect.h).toBeCloseTo(0.408, 6)
  })
  it('snaps the south edge to a target', () => {
    const { rect, guides } = applySnap(
      's',
      { x: 0.1, y: 0.1, w: 0.2, h: 0.395 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.h).toBeCloseTo(0.4, 6)
    expect(guides).toContainEqual({ axis: 'y', pos: 0.5 })
  })
  it('snaps a SE corner on both axes', () => {
    const { rect, guides } = applySnap(
      'se',
      { x: 0.1, y: 0.1, w: 0.395, h: 0.395 },
      buildSnapTargets([]),
      OPTS
    )
    expect(rect.w).toBeCloseTo(0.4, 6)
    expect(rect.h).toBeCloseTo(0.4, 6)
    expect(guides).toHaveLength(2)
  })
})
