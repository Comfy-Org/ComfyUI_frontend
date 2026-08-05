import type { Transform, Vec2 } from '../node'

export type HandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate'

export const ROTATE_OFFSET = 24

const SIGN: Record<HandleId, Vec2> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  rotate: { x: 0, y: -1 }
}

const OPP: Record<HandleId, HandleId> = {
  nw: 'se',
  n: 's',
  ne: 'sw',
  e: 'w',
  se: 'nw',
  s: 'n',
  sw: 'ne',
  w: 'e',
  rotate: 'rotate'
}

function rot(p: Vec2, a: number): Vec2 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function center(t: Transform): Vec2 {
  return { x: t.x + t.w / 2, y: t.y + t.h / 2 }
}

function axes(t: Transform): { ex: Vec2; ey: Vec2 } {
  const c = Math.cos(t.rotation)
  const s = Math.sin(t.rotation)
  return { ex: { x: c, y: s }, ey: { x: -s, y: c } }
}

export function handlePos(t: Transform, h: HandleId): Vec2 {
  const cen = center(t)
  const local =
    h === 'rotate'
      ? { x: 0, y: -t.h / 2 - ROTATE_OFFSET }
      : { x: (SIGN[h].x * t.w) / 2, y: (SIGN[h].y * t.h) / 2 }
  const p = rot(local, t.rotation)
  return { x: cen.x + p.x, y: cen.y + p.y }
}

export function toLocalFrame(t: Transform, pt: Vec2): Vec2 {
  const cen = center(t)
  return rot({ x: pt.x - cen.x, y: pt.y - cen.y }, -t.rotation)
}

export function hitHandle(
  t: Transform,
  pt: Vec2,
  tol: number
): HandleId | null {
  const order: HandleId[] = [
    'rotate',
    'nw',
    'ne',
    'se',
    'sw',
    'n',
    'e',
    's',
    'w'
  ]
  for (const h of order) {
    const hp = handlePos(t, h)
    if (Math.hypot(pt.x - hp.x, pt.y - hp.y) <= tol) return h
  }
  return null
}

export function insideBox(t: Transform, pt: Vec2): boolean {
  const l = toLocalFrame(t, pt)
  return Math.abs(l.x) <= t.w / 2 && Math.abs(l.y) <= t.h / 2
}

export function applyMove(t: Transform, dx: number, dy: number): Transform {
  return { ...t, x: t.x + dx, y: t.y + dy }
}

export function applyResize(
  t: Transform,
  h: HandleId,
  pt: Vec2,
  minSize = 1,
  keepAspect = false
): Transform {
  if (h === 'rotate') return t
  const anchor = handlePos(t, OPP[h])
  const { ex, ey } = axes(t)
  const dir = SIGN[h]
  const controlsX = dir.x !== 0
  const controlsY = dir.y !== 0

  const d = { x: pt.x - anchor.x, y: pt.y - anchor.y }
  const projX = d.x * ex.x + d.y * ex.y
  const projY = d.x * ey.x + d.y * ey.y

  const oc = center(t)
  const ocRel = {
    x: (oc.x - anchor.x) * ex.x + (oc.y - anchor.y) * ex.y,
    y: (oc.x - anchor.x) * ey.x + (oc.y - anchor.y) * ey.y
  }

  if (keepAspect && t.w > 0 && t.h > 0) {
    let s: number
    if (controlsX && controlsY) {
      const vx = dir.x * t.w
      const vy = dir.y * t.h
      s = (projX * vx + projY * vy) / (vx * vx + vy * vy)
    } else if (controlsX) {
      s = (dir.x * projX) / t.w
    } else {
      s = (dir.y * projY) / t.h
    }
    s = Math.max(s, minSize / t.w, minSize / t.h)
    const relX = ocRel.x * s
    const relY = ocRel.y * s
    const newW = t.w * s
    const newH = t.h * s
    const nc = {
      x: anchor.x + ex.x * relX + ey.x * relY,
      y: anchor.y + ex.y * relX + ey.y * relY
    }
    return {
      x: nc.x - newW / 2,
      y: nc.y - newH / 2,
      w: newW,
      h: newH,
      rotation: t.rotation
    }
  }

  const newW = controlsX ? Math.max(minSize, Math.abs(projX)) : t.w
  const newH = controlsY ? Math.max(minSize, Math.abs(projY)) : t.h

  const relX = controlsX ? (dir.x * newW) / 2 : ocRel.x
  const relY = controlsY ? (dir.y * newH) / 2 : ocRel.y

  const nc = {
    x: anchor.x + ex.x * relX + ey.x * relY,
    y: anchor.y + ex.y * relX + ey.y * relY
  }
  return {
    x: nc.x - newW / 2,
    y: nc.y - newH / 2,
    w: newW,
    h: newH,
    rotation: t.rotation
  }
}

export function angleTo(t: Transform, pt: Vec2): number {
  const c = center(t)
  return Math.atan2(pt.y - c.y, pt.x - c.x)
}

export function applyRotate(
  t: Transform,
  baseRotation: number,
  grabAngle: number,
  pt: Vec2,
  snap = 0
): Transform {
  let rotation = baseRotation + (angleTo(t, pt) - grabAngle)
  if (snap > 0) rotation = Math.round(rotation / snap) * snap
  return { ...t, rotation }
}

export function unionBounds(boxes: Transform[]): Transform {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const corners: HandleId[] = ['nw', 'ne', 'se', 'sw']
  for (const b of boxes) {
    for (const h of corners) {
      const p = handlePos(b, h)
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, rotation: 0 }
}

export function scaleAround(
  t: Transform,
  anchor: Vec2,
  scale: number
): Transform {
  const c = center(t)
  const nc = {
    x: anchor.x + (c.x - anchor.x) * scale,
    y: anchor.y + (c.y - anchor.y) * scale
  }
  const w = t.w * scale
  const h = t.h * scale
  return { x: nc.x - w / 2, y: nc.y - h / 2, w, h, rotation: t.rotation }
}

export function rotateAround(
  t: Transform,
  pivot: Vec2,
  theta: number
): Transform {
  const c = center(t)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const dx = c.x - pivot.x
  const dy = c.y - pivot.y
  const nc = {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos
  }
  return {
    x: nc.x - t.w / 2,
    y: nc.y - t.h / 2,
    w: t.w,
    h: t.h,
    rotation: t.rotation + theta
  }
}

export function groupResize(
  gizmo: Transform,
  handle: HandleId,
  pt: Vec2,
  minSize = 1
): { gizmo: Transform; anchor: Vec2; scale: number } {
  const next = applyResize(gizmo, handle, pt, minSize, true)
  const anchor = handlePos(gizmo, OPP[handle])
  const scale = gizmo.w > 0 ? next.w / gizmo.w : 1
  return { gizmo: next, anchor, scale }
}

export function alignedTo(
  rotation: number,
  frameRotation: number,
  eps = 1e-6
): boolean {
  const k = (rotation - frameRotation) / (Math.PI / 2)
  return Math.abs(k - Math.round(k)) < eps
}

export function groupScale(
  gizmo: Transform,
  handle: HandleId,
  pt: Vec2,
  minSize = 1
): { gizmo: Transform; anchor: Vec2; sx: number; sy: number } {
  const next = applyResize(gizmo, handle, pt, minSize, false)
  const anchor = handlePos(gizmo, OPP[handle])
  const sx = gizmo.w > 0 ? next.w / gizmo.w : 1
  const sy = gizmo.h > 0 ? next.h / gizmo.h : 1
  return { gizmo: next, anchor, sx, sy }
}

export function scaleAroundFrame(
  t: Transform,
  anchor: Vec2,
  frameRotation: number,
  sx: number,
  sy: number
): Transform {
  const c = center(t)
  const cos = Math.cos(frameRotation)
  const sin = Math.sin(frameRotation)
  const dx = c.x - anchor.x
  const dy = c.y - anchor.y
  const fx = (dx * cos + dy * sin) * sx
  const fy = (-dx * sin + dy * cos) * sy
  const nc = {
    x: anchor.x + fx * cos - fy * sin,
    y: anchor.y + fx * sin + fy * cos
  }
  const swap =
    Math.round((t.rotation - frameRotation) / (Math.PI / 2)) % 2 !== 0
  const w = t.w * (swap ? sy : sx)
  const h = t.h * (swap ? sx : sy)
  return { x: nc.x - w / 2, y: nc.y - h / 2, w, h, rotation: t.rotation }
}
