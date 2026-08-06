import { generateId } from './id'
import type { Rect, Vec2 } from './node'

export type AnchorType = 'anchor' | 'control'

export interface Anchor {
  pos: Vec2
  type: AnchorType
  selected: boolean
}

export interface Stroke {
  id: string
  anchors: Anchor[]
  closed: boolean
}

export interface PathData {
  strokes: Stroke[]
}

export type AnchorFeature = 'none' | 'edge' | 'aligned' | 'symmetric'

export interface FillStyle {
  color: string
  rule?: 'nonzero' | 'evenodd'
  opacity?: number
}

export interface StrokeStyle {
  color: string
  width: number
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  miterLimit?: number
  dash?: number[]
  opacity?: number
}

export const ELLIPSE_KAPPA = (4 * (Math.SQRT2 - 1)) / 3

const a = (x: number, y: number, type: AnchorType): Anchor => ({
  pos: { x, y },
  type,
  selected: false
})

export function strokeFromTriples(points: Vec2[], closed: boolean): Stroke {
  const anchors: Anchor[] = []
  for (let i = 0; i < points.length; i += 3) {
    anchors.push(a(points[i].x, points[i].y, 'control'))
    anchors.push(a(points[i + 1].x, points[i + 1].y, 'anchor'))
    anchors.push(a(points[i + 2].x, points[i + 2].y, 'control'))
  }
  return { id: generateId('stroke'), anchors, closed }
}

export function rectPath(x: number, y: number, w: number, h: number): PathData {
  const corners: Vec2[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ]
  const triples: Vec2[] = []
  for (const c of corners) triples.push(c, c, c)
  return { strokes: [strokeFromTriples(triples, true)] }
}

export function ellipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number
): PathData {
  const kx = ELLIPSE_KAPPA * rx
  const ky = ELLIPSE_KAPPA * ry
  const triples: Vec2[] = [
    { x: cx - kx, y: cy - ry },
    { x: cx, y: cy - ry },
    { x: cx + kx, y: cy - ry },
    { x: cx + rx, y: cy - ky },
    { x: cx + rx, y: cy },
    { x: cx + rx, y: cy + ky },
    { x: cx + kx, y: cy + ry },
    { x: cx, y: cy + ry },
    { x: cx - kx, y: cy + ry },
    { x: cx - rx, y: cy + ky },
    { x: cx - rx, y: cy },
    { x: cx - rx, y: cy - ky }
  ]
  return { strokes: [strokeFromTriples(triples, true)] }
}

export function linePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): PathData {
  const triples: Vec2[] = [
    { x: x1, y: y1 },
    { x: x1, y: y1 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x2, y: y2 },
    { x: x2, y: y2 }
  ]
  return { strokes: [strokeFromTriples(triples, false)] }
}

export function polygonPath(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number
): PathData {
  const n = Math.max(3, Math.round(sides))
  const triples: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const ang = rotation + (i * 2 * Math.PI) / n
    const p = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
    triples.push(p, p, p)
  }
  return { strokes: [strokeFromTriples(triples, true)] }
}

export function starPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  points: number,
  rotation: number
): PathData {
  const n = Math.max(3, Math.round(points))
  const triples: Vec2[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const ang = rotation + (i * Math.PI) / n
    const p = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
    triples.push(p, p, p)
  }
  return { strokes: [strokeFromTriples(triples, true)] }
}

export function arcPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): PathData {
  const chord = Math.hypot(x2 - x1, y2 - y1)
  if (chord === 0) return { strokes: [] }
  const r = chord / 2
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const a0 = Math.atan2(y1 - my, x1 - mx)
  const k = ELLIPSE_KAPPA * r
  const triples: Vec2[] = []
  for (let i = 0; i <= 2; i++) {
    const ang = a0 + (i * Math.PI) / 2
    const p = { x: mx + Math.cos(ang) * r, y: my + Math.sin(ang) * r }
    const t = { x: -Math.sin(ang), y: Math.cos(ang) }
    triples.push({ x: p.x - t.x * k, y: p.y - t.y * k }, p, {
      x: p.x + t.x * k,
      y: p.y + t.y * k
    })
  }
  return { strokes: [strokeFromTriples(triples, false)] }
}

export function spiralPath(
  cx: number,
  cy: number,
  r: number,
  turns: number,
  endAngle: number
): PathData {
  const t = Math.max(1, Math.round(turns))
  const steps = t * 32
  const total = t * 2 * Math.PI
  const triples: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const ang = endAngle - total * (1 - f)
    const p = { x: cx + Math.cos(ang) * r * f, y: cy + Math.sin(ang) * r * f }
    triples.push(p, p, p)
  }
  return { strokes: [strokeFromTriples(triples, false)] }
}

interface Segment {
  from: Vec2
  c1: Vec2
  c2: Vec2
  to: Vec2
}

export function strokeSegments(stroke: Stroke): Segment[] {
  const n = stroke.anchors.length
  if (n < 3 || n % 3 !== 0) return []
  const count = n / 3
  if (count < 2 && !stroke.closed) return []
  const anchorAt = (i: number): Vec2 => stroke.anchors[i * 3 + 1].pos
  const leadingAt = (i: number): Vec2 => stroke.anchors[i * 3].pos
  const trailingAt = (i: number): Vec2 => stroke.anchors[i * 3 + 2].pos
  const segs: Segment[] = []
  const last = stroke.closed ? count : count - 1
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % count
    segs.push({
      from: anchorAt(i),
      c1: trailingAt(i),
      c2: leadingAt(j),
      to: anchorAt(j)
    })
  }
  return segs
}

export function pathToPath2D(path: PathData): Path2D | null {
  if (typeof Path2D === 'undefined') return null
  const p = new Path2D()
  for (const stroke of path.strokes) {
    const segs = strokeSegments(stroke)
    if (segs.length === 0) continue
    p.moveTo(segs[0].from.x, segs[0].from.y)
    for (const s of segs) {
      p.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y)
    }
    if (stroke.closed) p.closePath()
  }
  return p
}

export function pathBounds(path: PathData, strokeWidth = 0): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of path.strokes) {
    for (const anchor of stroke.anchors) {
      minX = Math.min(minX, anchor.pos.x)
      minY = Math.min(minY, anchor.pos.y)
      maxX = Math.max(maxX, anchor.pos.x)
      maxY = Math.max(maxY, anchor.pos.y)
    }
  }
  if (!isFinite(minX)) return null
  const half = strokeWidth / 2
  const x = Math.floor(minX - half)
  const y = Math.floor(minY - half)
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(maxX + half) - x),
    h: Math.max(1, Math.ceil(maxY + half) - y)
  }
}

export function transformPath(
  path: PathData,
  map: (pt: Vec2) => Vec2
): PathData {
  return {
    strokes: path.strokes.map((stroke) => ({
      ...stroke,
      anchors: stroke.anchors.map((anchor) => ({
        ...anchor,
        pos: map(anchor.pos)
      }))
    }))
  }
}

export function clonePath(path: PathData): PathData {
  return transformPath(path, (pt) => ({ ...pt }))
}

function cubic(p0: Vec2, c0: Vec2, c1: Vec2, p1: Vec2, t: number): Vec2 {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * p0.x + w1 * c0.x + w2 * c1.x + w3 * p1.x,
    y: w0 * p0.y + w1 * c0.y + w2 * c1.y + w3 * p1.y
  }
}

export function flattenStroke(stroke: Stroke, steps = 16): Vec2[] {
  const segs = strokeSegments(stroke)
  if (segs.length === 0) {
    return stroke.anchors.filter((x) => x.type === 'anchor').map((x) => x.pos)
  }
  const out: Vec2[] = [segs[0].from]
  for (const s of segs) {
    for (let k = 1; k <= steps; k++)
      out.push(cubic(s.from, s.c1, s.c2, s.to, k / steps))
  }
  return out
}

export function flatten(path: PathData, steps = 16): Vec2[][] {
  return path.strokes.map((s) => flattenStroke(s, steps))
}
