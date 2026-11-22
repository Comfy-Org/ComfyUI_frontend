import { describe, expect, it } from 'vitest'

import {
  borderMask,
  combineMasks,
  ellipseMask,
  emptyMask,
  featherMask,
  floodSelectMask,
  growMask,
  maskBoundary,
  maskBounds,
  polygonMask,
  rectMask,
  shrinkMask
} from './selectionMath'
import type { FloodSource, GrayMask } from './selectionMath'

function maskOf(
  width: number,
  height: number,
  on: Array<[number, number]>
): GrayMask {
  const m = emptyMask(width, height)
  for (const [x, y] of on) m.data[y * width + x] = 1
  return m
}

function selectedCells(m: GrayMask): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y * m.width + x] > 0.5) out.push([x, y])
    }
  }
  return out
}

describe('combineMasks (GIMP gimp-gegl-mask-combine semantics)', () => {
  const base = maskOf(4, 1, [
    [0, 0],
    [1, 0]
  ])
  const addOn = maskOf(4, 1, [
    [1, 0],
    [2, 0]
  ])

  it('replace takes the add-on', () => {
    expect([...combineMasks(base, addOn, 'replace').data]).toEqual([0, 1, 1, 0])
  })
  it('add is clamped sum', () => {
    expect([...combineMasks(base, addOn, 'add').data]).toEqual([1, 1, 1, 0])
  })
  it('subtract is clamped difference', () => {
    expect([...combineMasks(base, addOn, 'subtract').data]).toEqual([
      1, 0, 0, 0
    ])
  })
  it('intersect is min', () => {
    expect([...combineMasks(base, addOn, 'intersect').data]).toEqual([
      0, 1, 0, 0
    ])
  })
})

describe('shape masks', () => {
  it('rectMask fills the exact pixel rect', () => {
    const m = rectMask(6, 4, { x: 1, y: 1, w: 3, h: 2 })
    expect(maskBounds(m)).toEqual({ x: 1, y: 1, w: 3, h: 2 })
    expect(m.data[0]).toBe(0)
    expect(m.data[1 * 6 + 2]).toBe(1)
  })

  it('ellipseMask covers the center and misses corners', () => {
    const m = ellipseMask(20, 20, { x: 2, y: 2, w: 16, h: 16 })
    expect(m.data[10 * 20 + 10]).toBe(1)
    expect(m.data[2 * 20 + 2]).toBe(0)
  })

  it('polygonMask rasterizes a triangle', () => {
    const m = polygonMask(10, 10, [
      { x: 1, y: 1 },
      { x: 9, y: 1 },
      { x: 1, y: 9 }
    ])
    expect(m.data[2 * 10 + 2]).toBeGreaterThan(0.5)
    expect(m.data[8 * 10 + 8]).toBe(0)
  })
})

describe('morphology (GIMP grow/shrink/border, elliptical SE)', () => {
  it('grow dilates a point into a disc of the given radius', () => {
    const m = maskOf(11, 11, [[5, 5]])
    const g = growMask(m, 3)
    expect(g.data[5 * 11 + 8]).toBe(1)
    expect(g.data[2 * 11 + 5]).toBe(1)
    expect(g.data[5 * 11 + 9]).toBe(0)
    expect(g.data[1 * 11 + 1]).toBe(0)
  })

  it('shrink erodes edges and is the dual of grow', () => {
    const m = rectMask(11, 11, { x: 2, y: 2, w: 7, h: 7 })
    const s = shrinkMask(m, 2)
    const b = maskBounds(s)!
    expect(b.w).toBeLessThan(7)
    expect(s.data[5 * 11 + 5]).toBe(1)
    expect(s.data[2 * 11 + 2]).toBe(0)
  })

  it('shrink erodes from the image edge too (GIMP default edge_lock=false)', () => {
    const m = rectMask(8, 8, { x: 0, y: 0, w: 8, h: 4 })
    const s = shrinkMask(m, 2)
    expect(s.data[0]).toBe(0)
    expect(s.data[3 * 8 + 4]).toBe(0)
  })

  it('border is the ring between grown and shrunk', () => {
    const m = rectMask(15, 15, { x: 4, y: 4, w: 7, h: 7 })
    const b = borderMask(m, 2)
    expect(b.data[7 * 15 + 7]).toBe(0)
    expect(b.data[4 * 15 + 7]).toBe(1)
  })
})

describe('bounds-limited morphology matches the full-image result', () => {
  const eq = (a: GrayMask, b: GrayMask) => {
    for (let p = 0; p < a.data.length; p++) {
      if (Math.abs(a.data[p] - b.data[p]) > 1e-6) return false
    }
    return true
  }

  it('grow/shrink/border/feather with a bounds hint equal the unbounded ops', () => {
    const m = rectMask(64, 64, { x: 20, y: 24, w: 12, h: 10 })
    const bounds = maskBounds(m)!
    expect(eq(growMask(m, 3, bounds), growMask(m, 3))).toBe(true)
    expect(eq(shrinkMask(m, 3, bounds), shrinkMask(m, 3))).toBe(true)
    expect(eq(borderMask(m, 3, bounds), borderMask(m, 3))).toBe(true)
    expect(eq(featherMask(m, 6, bounds), featherMask(m, 6))).toBe(true)
  })

  it('bounded shrink matches when the selection touches the image edge', () => {
    const m = rectMask(32, 32, { x: 0, y: 0, w: 32, h: 12 })
    const bounds = maskBounds(m)!
    expect(eq(shrinkMask(m, 2, bounds), shrinkMask(m, 2))).toBe(true)
    expect(shrinkMask(m, 2, bounds).data[0]).toBe(0)
  })
})

describe('featherMask', () => {
  it('softens a hard edge into a gradient without moving its center', () => {
    const m = rectMask(40, 40, { x: 10, y: 10, w: 20, h: 20 })
    const f = featherMask(m, 8)
    expect(f.data[20 * 40 + 20]).toBeGreaterThan(0.9)
    expect(f.data[0]).toBeLessThan(0.05)
    const edge = f.data[20 * 40 + 10]
    expect(edge).toBeGreaterThan(0.2)
    expect(edge).toBeLessThan(0.8)
  })
})

describe('maskBoundary (marching ants outline)', () => {
  it('traces a rect mask as a single 4-corner loop', () => {
    const m = rectMask(10, 10, { x: 2, y: 3, w: 5, h: 4 })
    const loops = maskBoundary(m)
    expect(loops).toHaveLength(1)
    expect(loops[0]).toHaveLength(4)
    const xs = loops[0].map((p) => p.x).sort((a, b) => a - b)
    const ys = loops[0].map((p) => p.y).sort((a, b) => a - b)
    expect(xs).toEqual([2, 2, 7, 7])
    expect(ys).toEqual([3, 3, 7, 7])
  })

  it('traces two disjoint blobs as two loops', () => {
    const m = emptyMask(10, 4)
    m.data[1 * 10 + 1] = 1
    m.data[1 * 10 + 8] = 1
    expect(maskBoundary(m)).toHaveLength(2)
  })

  it('empty mask has no boundary', () => {
    expect(maskBoundary(emptyMask(5, 5))).toHaveLength(0)
  })
})

describe('floodSelectMask (GIMP scanline segment flood)', () => {
  function source(
    width: number,
    height: number,
    painter: (x: number, y: number) => [number, number, number]
  ): FloodSource {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = painter(x, y)
        const i = (y * width + x) * 4
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
    return { data, width, height }
  }

  it('selects only the contiguous region around the seed', () => {
    const src = source(9, 3, (x) => (x === 4 ? [255, 255, 255] : [0, 0, 0]))
    const m = floodSelectMask(src, { x: 1, y: 1 }, 0.1, false, true)!
    expect(m.data[1 * 9 + 0]).toBe(1)
    expect(m.data[1 * 9 + 3]).toBe(1)
    expect(m.data[1 * 9 + 4]).toBe(0)
    expect(m.data[1 * 9 + 6]).toBe(0)
  })

  it('U-shaped region floods around the barrier', () => {
    const src = source(5, 5, (x, y) =>
      x === 2 && y < 4 ? [255, 255, 255] : [0, 0, 0]
    )
    const m = floodSelectMask(src, { x: 0, y: 0 }, 0.1, false, true)!
    expect(m.data[0]).toBe(1)
    expect(m.data[4]).toBe(1)
    expect(m.data[2]).toBe(0)
  })

  it('non-contiguous mode matches the whole image by color', () => {
    const src = source(6, 1, (x) =>
      x % 2 === 0 ? [10, 10, 10] : [200, 200, 200]
    )
    const m = floodSelectMask(src, { x: 0, y: 0 }, 0.1, false, false)!
    expect(selectedCells(m).map(([x]) => x)).toEqual([0, 2, 4])
  })

  it('antialias grades pixels near the threshold (aa = 1.5 - d/t)', () => {
    const vals = [0, 51, 64, 200]
    const src = source(4, 1, (x) => [vals[x], vals[x], vals[x]])
    const m = floodSelectMask(src, { x: 0, y: 0 }, 0.2, true, true)!
    expect(m.data[0]).toBe(1)
    expect(m.data[1]).toBe(1)
    expect(m.data[2]).toBeGreaterThan(0.3)
    expect(m.data[2]).toBeLessThan(0.7)
    expect(m.data[3]).toBe(0)
  })

  it('threshold zero selects only exact-match pixels', () => {
    const src = source(4, 1, (x) => (x < 2 ? [50, 50, 50] : [51, 51, 51]))
    const m = floodSelectMask(src, { x: 0, y: 0 }, 0, false, true)!
    expect(selectedCells(m).map(([x]) => x)).toEqual([0, 1])
  })
})
