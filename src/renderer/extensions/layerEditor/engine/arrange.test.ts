import { describe, expect, it } from 'vitest'

import { align, arrange, distribute, unionRect } from './arrange'

const A = { x: 0, y: 0, w: 10, h: 10 }
const B = { x: 40, y: 20, w: 20, h: 10 }
const C = { x: 90, y: 50, w: 10, h: 30 }

describe('unionRect', () => {
  it('covers all rects', () => {
    expect(unionRect([A, B, C])).toEqual({ x: 0, y: 0, w: 100, h: 80 })
  })
  it('handles empty', () => {
    expect(unionRect([])).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('align', () => {
  it('aligns left edges to the selection bbox by default', () => {
    const d = align([A, B, C], 'left')
    expect(d.map((v) => v.dx)).toEqual([0, -40, -90])
    expect(d.every((v) => v.dy === 0)).toBe(true)
  })
  it('aligns right edges', () => {
    const d = align([A, B, C], 'right')
    expect(d.map((v) => v.dx)).toEqual([90, 40, 0])
  })
  it('aligns horizontal centers', () => {
    const d = align([A, B, C], 'hcenter')
    expect(d.map((v) => v.dx)).toEqual([45, 0, -45])
  })
  it('aligns top/middle/bottom on y only', () => {
    const top = align([A, B, C], 'top')
    expect(top.map((v) => v.dy)).toEqual([0, -20, -50])
    expect(top.every((v) => v.dx === 0)).toBe(true)
    const bottom = align([A, B, C], 'bottom')
    expect(bottom.map((v) => v.dy)).toEqual([70, 50, 0])
    const mid = align([A, B, C], 'vcenter')
    expect(mid.map((v) => v.dy)).toEqual([35, 15, -25])
  })
  it('aligns to an explicit reference rect', () => {
    const d = align([A, B], 'left', { x: 100, y: 0, w: 10, h: 10 })
    expect(d.map((v) => v.dx)).toEqual([100, 60])
  })
})

describe('distribute spread (even centers)', () => {
  it('keeps first/last and evens the middle centers', () => {
    const d = distribute([A, B, C], 'hspread')
    expect(d[0]).toEqual({ dx: 0, dy: 0 })
    expect(d[2]).toEqual({ dx: 0, dy: 0 })
    const midCenter = B.x + B.w / 2 + d[1]!.dx
    expect(midCenter).toBeCloseTo((5 + 95) / 2, 6)
  })
  it('is input-order stable regardless of spatial order', () => {
    const d = distribute([C, A, B], 'hspread')
    expect(d[0]).toEqual({ dx: 0, dy: 0 })
    expect(d[1]).toEqual({ dx: 0, dy: 0 })
    expect(B.x + B.w / 2 + d[2]!.dx).toBeCloseTo(50, 6)
  })
  it('no-ops below three rects', () => {
    expect(distribute([A, B], 'hspread')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 }
    ])
  })
})

describe('distribute gap (even spacing, GIMP semantics)', () => {
  it('equalizes gaps and keeps first/last fixed', () => {
    const d = distribute([A, B, C], 'hgap')
    expect(d[0]).toEqual({ dx: 0, dy: 0 })
    expect(d[2]).toEqual({ dx: 0, dy: 0 })
    const bx = B.x + d[1]!.dx
    const gap1 = bx - (A.x + A.w)
    const gap2 = C.x - (bx + B.w)
    expect(gap1).toBeCloseTo(gap2, 6)
    expect(gap1).toBeCloseTo((C.x - (A.x + A.w) - B.w) / 2, 6)
  })
  it('works vertically', () => {
    const d = distribute([A, B, C], 'vgap')
    const by = B.y + d[1]!.dy
    const gap1 = by - (A.y + A.h)
    const gap2 = C.y - (by + B.h)
    expect(gap1).toBeCloseTo(gap2, 6)
  })
  it('handles four rects with equal gaps', () => {
    const D = { x: 200, y: 0, w: 30, h: 10 }
    const d = distribute([A, B, C, D], 'hgap')
    const bx = B.x + d[1]!.dx
    const cx = C.x + d[2]!.dx
    const gaps = [bx - (A.x + A.w), cx - (bx + B.w), D.x - (cx + C.w)]
    expect(gaps[0]).toBeCloseTo(gaps[1]!, 6)
    expect(gaps[1]).toBeCloseTo(gaps[2]!, 6)
  })
})

describe('arrange dispatch', () => {
  it('routes align and distribute ops', () => {
    expect(arrange([A, B, C], 'left').map((v) => v.dx)).toEqual([0, -40, -90])
    expect(arrange([A, B, C], 'hgap')[0]).toEqual({ dx: 0, dy: 0 })
  })
})
