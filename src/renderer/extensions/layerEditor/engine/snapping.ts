import type { Rect } from './node'
export interface SnapTargets {
  xs: number[]
  ys: number[]
}
export interface Guide {
  axis: 'x' | 'y'
  pos: number
  kind?: 'edge' | 'gap'
  cross?: number
  spans?: Array<[number, number]>
}
export interface SnapExtras {
  gridX?: number
  gridY?: number
  guideXs?: number[]
  guideYs?: number[]
}
export interface SnapOpts {
  thrX: number
  thrY: number
  minWH: number
  boundsW?: number
  boundsH?: number
  clamp?: boolean
  eqRects?: Rect[]
}
export interface SnapResult {
  rect: Rect
  guides: Guide[]
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function buildSnapTargets(
  otherRects: Rect[],
  bounds?: { w: number; h: number },
  extras?: SnapExtras
): SnapTargets {
  const bw = bounds?.w ?? 1
  const bh = bounds?.h ?? 1
  const xs = [0, bw / 2, bw]
  const ys = [0, bh / 2, bh]
  for (const r of otherRects) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w)
    ys.push(r.y, r.y + r.h / 2, r.y + r.h)
  }
  if (extras?.gridX && extras.gridX > 0) {
    for (let v = 0; v <= bw + 1e-9; v += extras.gridX) xs.push(v)
  }
  if (extras?.gridY && extras.gridY > 0) {
    for (let v = 0; v <= bh + 1e-9; v += extras.gridY) ys.push(v)
  }
  for (const g of extras?.guideXs ?? []) xs.push(g)
  for (const g of extras?.guideYs ?? []) ys.push(g)
  return { xs, ys }
}

interface EqCandidate {
  pos: number
  guide: Guide
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0
}

function eqCandidatesAxis(
  rect: Rect,
  others: Rect[],
  axis: 'x' | 'y'
): EqCandidate[] {
  const p = (r: Rect) => (axis === 'x' ? r.x : r.y)
  const s = (r: Rect) => (axis === 'x' ? r.w : r.h)
  const c0 = (r: Rect) => (axis === 'x' ? r.y : r.x)
  const c1 = (r: Rect) => (axis === 'x' ? r.y + r.h : r.x + r.w)
  const cross = axis === 'x' ? rect.y + rect.h / 2 : rect.x + rect.w / 2

  const near = others.filter((o) => overlaps(c0(o), c1(o), c0(rect), c1(rect)))
  const lefts = near
    .filter((o) => p(o) + s(o) <= p(rect) + s(rect) / 2)
    .sort((a, b) => p(b) + s(b) - (p(a) + s(a)))
  const rights = near
    .filter((o) => p(o) >= p(rect) + s(rect) / 2)
    .sort((a, b) => p(a) - p(b))
  const out: EqCandidate[] = []

  const L = lefts[0]
  const R = rights[0]
  if (L && R) {
    const free = p(R) - (p(L) + s(L)) - s(rect)
    if (free >= 0) {
      const pos = p(L) + s(L) + free / 2
      out.push({
        pos,
        guide: {
          axis,
          pos,
          kind: 'gap',
          cross,
          spans: [
            [p(L) + s(L), pos],
            [pos + s(rect), p(R)]
          ]
        }
      })
    }
  }
  if (lefts.length >= 2) {
    const L1 = lefts[0]
    const L2 = lefts[1]
    const gap = p(L1) - (p(L2) + s(L2))
    if (gap >= 0) {
      const pos = p(L1) + s(L1) + gap
      out.push({
        pos,
        guide: {
          axis,
          pos,
          kind: 'gap',
          cross,
          spans: [
            [p(L2) + s(L2), p(L1)],
            [p(L1) + s(L1), pos]
          ]
        }
      })
    }
  }
  if (rights.length >= 2) {
    const R1 = rights[0]
    const R2 = rights[1]
    const gap = p(R2) - (p(R1) + s(R1))
    if (gap >= 0) {
      const pos = p(R1) - gap - s(rect)
      out.push({
        pos,
        guide: {
          axis,
          pos,
          kind: 'gap',
          cross,
          spans: [
            [pos + s(rect), p(R1)],
            [p(R1) + s(R1), p(R2)]
          ]
        }
      })
    }
  }
  return out
}

export function nearestTarget(
  val: number,
  targets: number[],
  thr: number
): number | null {
  let best: number | null = null
  let bd = thr
  for (const t of targets) {
    const dd = Math.abs(val - t)
    if (dd < bd) {
      bd = dd
      best = t
    }
  }
  return best
}

export function applySnap(
  mode: string,
  rect: Rect,
  targets: SnapTargets,
  opts: SnapOpts
): SnapResult {
  let { x, y, w, h } = rect
  const guides: Guide[] = []
  const { thrX, thrY, minWH } = opts
  const bw = opts.boundsW ?? 1
  const bh = opts.boundsH ?? 1
  const clamp = opts.clamp !== false

  if (mode === 'move') {
    let bestDX: number | null = null
    let guideX: Guide | null = null
    for (const v of [x, x + w / 2, x + w]) {
      const t = nearestTarget(v, targets.xs, thrX)
      if (t != null) {
        const dd = t - v
        if (bestDX === null || Math.abs(dd) < Math.abs(bestDX)) {
          bestDX = dd
          guideX = { axis: 'x', pos: t, kind: 'edge' }
        }
      }
    }
    let bestDY: number | null = null
    let guideY: Guide | null = null
    for (const v of [y, y + h / 2, y + h]) {
      const t = nearestTarget(v, targets.ys, thrY)
      if (t != null) {
        const dd = t - v
        if (bestDY === null || Math.abs(dd) < Math.abs(bestDY)) {
          bestDY = dd
          guideY = { axis: 'y', pos: t, kind: 'edge' }
        }
      }
    }
    if (opts.eqRects?.length) {
      for (const c of eqCandidatesAxis(rect, opts.eqRects, 'x')) {
        const dd = c.pos - x
        if (
          Math.abs(dd) < thrX &&
          (bestDX === null || Math.abs(dd) < Math.abs(bestDX))
        ) {
          bestDX = dd
          guideX = c.guide
        }
      }
      for (const c of eqCandidatesAxis(rect, opts.eqRects, 'y')) {
        const dd = c.pos - y
        if (
          Math.abs(dd) < thrY &&
          (bestDY === null || Math.abs(dd) < Math.abs(bestDY))
        ) {
          bestDY = dd
          guideY = c.guide
        }
      }
    }
    if (bestDX !== null && guideX) {
      x += bestDX
      guides.push(guideX)
    }
    if (bestDY !== null && guideY) {
      y += bestDY
      guides.push(guideY)
    }
  } else {
    if (mode.includes('e')) {
      const t = nearestTarget(x + w, targets.xs, thrX)
      if (t != null) {
        w = t - x
        guides.push({ axis: 'x', pos: t })
      }
    }
    if (mode.includes('w')) {
      const t = nearestTarget(x, targets.xs, thrX)
      if (t != null) {
        const rt = x + w
        x = t
        w = rt - x
        guides.push({ axis: 'x', pos: t })
      }
    }
    if (mode.includes('s')) {
      const t = nearestTarget(y + h, targets.ys, thrY)
      if (t != null) {
        h = t - y
        guides.push({ axis: 'y', pos: t })
      }
    }
    if (mode.includes('n')) {
      const t = nearestTarget(y, targets.ys, thrY)
      if (t != null) {
        const bt = y + h
        y = t
        h = bt - y
        guides.push({ axis: 'y', pos: t })
      }
    }
    w = Math.max(minWH, w)
    h = Math.max(minWH, h)
  }

  if (clamp) {
    x = clampNum(x, 0, Math.max(0, bw - w))
    y = clampNum(y, 0, Math.max(0, bh - h))
  }
  return { rect: { x, y, w, h }, guides }
}
