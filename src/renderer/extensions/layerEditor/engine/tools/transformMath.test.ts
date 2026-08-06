import { describe, expect, it } from 'vitest'

import type { Transform } from '../node'
import {
  alignedTo,
  applyMove,
  applyResize,
  applyRotate,
  center,
  groupResize,
  groupScale,
  handlePos,
  hitHandle,
  insideBox,
  rotateAround,
  scaleAround,
  scaleAroundFrame,
  toLocalFrame,
  unionBounds
} from './transformMath'

const box: Transform = { x: 10, y: 20, w: 100, h: 60, rotation: 0 }

describe('handlePos / hitHandle (axis-aligned)', () => {
  it('places corner + edge handles on the box', () => {
    expect(handlePos(box, 'nw')).toEqual({ x: 10, y: 20 })
    expect(handlePos(box, 'se')).toEqual({ x: 110, y: 80 })
    expect(handlePos(box, 'n')).toEqual({ x: 60, y: 20 })
  })

  it('hits the nearest handle within tolerance', () => {
    expect(hitHandle(box, { x: 111, y: 81 }, 4)).toBe('se')
    expect(hitHandle(box, { x: 60, y: 50 }, 4)).toBeNull()
  })
})

describe('insideBox / toLocalFrame with rotation', () => {
  it('maps a doc point into the centre-origin local frame', () => {
    const p = toLocalFrame(box, { x: 60, y: 50 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('respects rotation for containment', () => {
    const rotated: Transform = {
      x: 0,
      y: 0,
      w: 100,
      h: 20,
      rotation: Math.PI / 2
    }

    expect(insideBox(rotated, { x: 50, y: 50 })).toBe(true)
    const cen = { x: 50, y: 10 }
    expect(insideBox(rotated, { x: cen.x, y: cen.y + 40 })).toBe(true)
  })
})

describe('applyMove', () => {
  it('translates the box', () => {
    expect(applyMove(box, 5, -3)).toMatchObject({ x: 15, y: 17, w: 100, h: 60 })
  })
})

describe('applyResize (axis-aligned reduces to simple)', () => {
  it('dragging SE keeps NW anchored', () => {
    const r = applyResize(box, 'se', { x: 10 + 200, y: 20 + 120 })
    expect(r).toMatchObject({ x: 10, y: 20, w: 200, h: 120 })
  })

  it('dragging E changes only width, keeps height + y', () => {
    const r = applyResize(box, 'e', { x: 310, y: 999 })
    expect(r.w).toBeCloseTo(300)
    expect(r.h).toBeCloseTo(60)
    expect(r.y).toBeCloseTo(20)
  })

  it('clamps to a minimum size', () => {
    const r = applyResize(box, 'se', { x: 10, y: 20 }, 1)
    expect(r.w).toBe(1)
    expect(r.h).toBe(1)
  })
})

describe('applyResize with keepAspect (GIMP constrained scale)', () => {
  it('corner drag projects onto the diagonal and keeps the anchor fixed', () => {
    const r = applyResize(box, 'se', { x: 210, y: 80 }, 1, true)
    const s = (200 * 100 + 60 * 60) / (100 * 100 + 60 * 60)
    expect(r.w).toBeCloseTo(100 * s)
    expect(r.h).toBeCloseTo(60 * s)
    expect(r.w / r.h).toBeCloseTo(100 / 60)
    expect(r.x).toBeCloseTo(10)
    expect(r.y).toBeCloseTo(20)
  })

  it('edge drag scales both dimensions about the opposite edge midpoint', () => {
    const r = applyResize(box, 'e', { x: 310, y: 999 }, 1, true)
    expect(r.w).toBeCloseTo(300)
    expect(r.h).toBeCloseTo(180)
    expect(r.x).toBeCloseTo(10)
    expect(r.y).toBeCloseTo(-40)
  })

  it('preserves the ratio on rotated boxes', () => {
    const rotated: Transform = {
      x: 10,
      y: 20,
      w: 100,
      h: 60,
      rotation: Math.PI / 5
    }
    const r = applyResize(rotated, 'nw', { x: -37, y: 3 }, 1, true)
    expect(r.w / r.h).toBeCloseTo(100 / 60)
    expect(r.rotation).toBe(rotated.rotation)
  })

  it('clamps the uniform factor so both dims stay above minSize', () => {
    const r = applyResize(box, 'se', { x: 10, y: 20 }, 1, true)
    expect(r.w).toBeGreaterThanOrEqual(1)
    expect(r.h).toBeGreaterThanOrEqual(1)
    expect(r.w / r.h).toBeCloseTo(100 / 60)
  })
})

describe('applyRotate', () => {
  it('adds the pointer-angle delta to the base rotation', () => {
    const grab = 0

    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const r = applyRotate(box, 0, grab, { x: c.x, y: c.y + 50 })
    expect(r.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('snaps to 15° increments when requested', () => {
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const r = applyRotate(
      box,
      0,
      0,
      { x: c.x + 100, y: c.y + 10 },
      Math.PI / 12
    )
    expect((r.rotation / (Math.PI / 12)) % 1).toBeCloseTo(0)
  })
})

describe('unionBounds (GIMP unified box)', () => {
  it('encloses two axis-aligned boxes', () => {
    const a: Transform = { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    const b: Transform = { x: 100, y: 20, w: 40, h: 60, rotation: 0 }
    expect(unionBounds([a, b])).toMatchObject({
      x: 0,
      y: 0,
      w: 140,
      h: 80,
      rotation: 0
    })
  })

  it('expands to cover a rotated box by its corners', () => {
    const rotated: Transform = {
      x: 0,
      y: 0,
      w: 100,
      h: 20,
      rotation: Math.PI / 2
    }
    const u = unionBounds([rotated])
    expect(u.x).toBeCloseTo(40)
    expect(u.y).toBeCloseTo(-40)
    expect(u.w).toBeCloseTo(20)
    expect(u.h).toBeCloseTo(100)
  })
})

describe('scaleAround (uniform group scale about a shared anchor)', () => {
  it('keeps the anchor fixed and scales centre + size', () => {
    const t: Transform = { x: 10, y: 10, w: 20, h: 20, rotation: 0 }
    const r = scaleAround(t, { x: 0, y: 0 }, 2)
    expect(center(r)).toMatchObject({ x: 40, y: 40 })
    expect(r).toMatchObject({ w: 40, h: 40, rotation: 0 })
  })

  it('leaves each layer rotation untouched', () => {
    const t: Transform = { x: 0, y: 0, w: 10, h: 10, rotation: 0.7 }
    expect(scaleAround(t, { x: 100, y: 100 }, 0.5).rotation).toBe(0.7)
  })
})

describe('rotateAround (group rotate about a shared pivot)', () => {
  it('orbits the centre about the pivot and adds to the layer rotation', () => {
    const t: Transform = { x: 90, y: -10, w: 20, h: 20, rotation: 0 }
    const r = rotateAround(t, { x: 0, y: 0 }, Math.PI / 2)
    expect(center(r).x).toBeCloseTo(0)
    expect(center(r).y).toBeCloseTo(100)
    expect(r.rotation).toBeCloseTo(Math.PI / 2)
    expect(r).toMatchObject({ w: 20, h: 20 })
  })

  it('pivot at the box centre is a pure spin', () => {
    const t: Transform = { x: 0, y: 0, w: 40, h: 20, rotation: 0 }
    const r = rotateAround(t, center(t), 0.3)
    expect(center(r)).toMatchObject({ x: 20, y: 10 })
    expect(r.rotation).toBeCloseTo(0.3)
  })
})

describe('groupResize (uniform gizmo handle drag)', () => {
  it('returns a uniform scale and the opposite-handle anchor', () => {
    const gizmo: Transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    const { anchor, scale } = groupResize(gizmo, 'se', { x: 200, y: 200 }, 1)
    expect(anchor).toMatchObject({ x: 0, y: 0 })
    expect(scale).toBeCloseTo(2)
  })
})

describe('alignedTo (axis-aligned to the gizmo frame)', () => {
  it('accepts multiples of 90° relative to the frame', () => {
    expect(alignedTo(0, 0)).toBe(true)
    expect(alignedTo(Math.PI / 2, 0)).toBe(true)
    expect(alignedTo(Math.PI, 0)).toBe(true)
    expect(alignedTo(0.6 + Math.PI / 2, 0.6)).toBe(true)
  })
  it('rejects an arbitrary relative angle', () => {
    expect(alignedTo(0.3, 0)).toBe(false)
  })
})

describe('groupScale (non-uniform gizmo handle drag)', () => {
  it('an edge drag scales only one axis', () => {
    const gizmo: Transform = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    const { anchor, sx, sy } = groupScale(gizmo, 'e', { x: 300, y: 50 }, 1)
    expect(anchor).toMatchObject({ x: 0, y: 50 })
    expect(sx).toBeCloseTo(3)
    expect(sy).toBeCloseTo(1)
  })
})

describe('scaleAroundFrame (per-axis scale within a frame)', () => {
  it('scales each axis independently about the anchor (frame rotation 0)', () => {
    const t: Transform = { x: 10, y: 10, w: 20, h: 20, rotation: 0 }
    const r = scaleAroundFrame(t, { x: 0, y: 0 }, 0, 2, 3)
    expect(center(r)).toMatchObject({ x: 40, y: 60 })
    expect(r).toMatchObject({ w: 40, h: 60, rotation: 0 })
  })

  it('matches uniform scaleAround when sx === sy', () => {
    const t: Transform = { x: 5, y: 7, w: 12, h: 30, rotation: 0.9 }
    const a = scaleAroundFrame(t, { x: 3, y: 3 }, 0, 1.5, 1.5)
    const b = scaleAround(t, { x: 3, y: 3 }, 1.5)
    expect(a.x).toBeCloseTo(b.x)
    expect(a.y).toBeCloseTo(b.y)
    expect(a.w).toBeCloseTo(b.w)
    expect(a.h).toBeCloseTo(b.h)
  })

  it('swaps w/h when the box sits at 90° to the frame', () => {
    const t: Transform = { x: 0, y: 0, w: 40, h: 10, rotation: Math.PI / 2 }
    const r = scaleAroundFrame(t, { x: 0, y: 0 }, 0, 2, 5)
    expect(r.w).toBeCloseTo(40 * 5)
    expect(r.h).toBeCloseTo(10 * 2)
  })
})
