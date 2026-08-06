import type { Rect } from './node'

export type AlignOp =
  | 'left'
  | 'hcenter'
  | 'right'
  | 'top'
  | 'vcenter'
  | 'bottom'
export type DistributeOp = 'hspread' | 'vspread' | 'hgap' | 'vgap'
export type ArrangeOp = AlignOp | DistributeOp

export interface Delta {
  dx: number
  dy: number
}

const ALIGN_FACTOR: Record<AlignOp, { axis: 'x' | 'y'; f: number }> = {
  left: { axis: 'x', f: 0 },
  hcenter: { axis: 'x', f: 0.5 },
  right: { axis: 'x', f: 1 },
  top: { axis: 'y', f: 0 },
  vcenter: { axis: 'y', f: 0.5 },
  bottom: { axis: 'y', f: 1 }
}

export function isAlignOp(op: ArrangeOp): op is AlignOp {
  return op in ALIGN_FACTOR
}

export function unionRect(rects: Rect[]): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function anchorOf(r: Rect, axis: 'x' | 'y', f: number): number {
  return axis === 'x' ? r.x + r.w * f : r.y + r.h * f
}

export function align(rects: Rect[], op: AlignOp, reference?: Rect): Delta[] {
  const { axis, f } = ALIGN_FACTOR[op]
  if (rects.length === 0) return []
  const ref = reference ?? unionRect(rects)
  const target = anchorOf(ref, axis, f)
  return rects.map((r) => {
    const d = target - anchorOf(r, axis, f)
    return axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d }
  })
}

export function distribute(rects: Rect[], op: DistributeOp): Delta[] {
  const zero = rects.map(() => ({ dx: 0, dy: 0 }))
  if (rects.length < 3) return zero
  const axis: 'x' | 'y' = op === 'hspread' || op === 'hgap' ? 'x' : 'y'
  const size = (r: Rect) => (axis === 'x' ? r.w : r.h)
  const pos = (r: Rect) => (axis === 'x' ? r.x : r.y)

  const order = rects
    .map((r, i) => ({ r, i }))
    .sort((a, b) =>
      op === 'hgap' || op === 'vgap'
        ? pos(a.r) - pos(b.r)
        : anchorOf(a.r, axis, 0.5) - anchorOf(b.r, axis, 0.5)
    )

  const out = zero
  const first = order[0]!
  const last = order[order.length - 1]!

  if (op === 'hspread' || op === 'vspread') {
    const a0 = anchorOf(first.r, axis, 0.5)
    const a1 = anchorOf(last.r, axis, 0.5)
    const fill = (a1 - a0) / (order.length - 1)
    for (let n = 1; n < order.length - 1; n++) {
      const { r, i } = order[n]!
      const d = a0 + n * fill - anchorOf(r, axis, 0.5)
      out[i] = axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d }
    }
    return out
  }

  let midSizes = 0
  for (let n = 1; n < order.length - 1; n++) midSizes += size(order[n]!.r)
  const span = pos(last.r) - (pos(first.r) + size(first.r))
  const gap = (span - midSizes) / (order.length - 1)
  let z = pos(first.r) + size(first.r)
  for (let n = 1; n < order.length - 1; n++) {
    const { r, i } = order[n]!
    const d = z + gap - pos(r)
    out[i] = axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d }
    z += gap + size(r)
  }
  return out
}

export function arrange(
  rects: Rect[],
  op: ArrangeOp,
  reference?: Rect
): Delta[] {
  return isAlignOp(op)
    ? align(rects, op, reference)
    : distribute(rects, op as DistributeOp)
}
