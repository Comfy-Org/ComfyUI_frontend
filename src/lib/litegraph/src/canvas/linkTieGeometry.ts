import type { Point } from '@/lib/litegraph/src/interfaces'
import { distance } from '@/lib/litegraph/src/measure'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import type { Point as LayoutPoint } from '@/renderer/core/layout/types'
import type { LinkId } from '@/types/linkId'
import type { LinkTie, LinkTieDraft } from '@/types/linkTie'

export const TIE_HALF_WIDTH = 2.5
const TIE_END_PAD = 3
const CONTROL_FACTOR = 0.25

export interface LinkTieSegment {
  a: Point
  b: Point
  startDir: LinkDirection
  endDir: LinkDirection
  startControl?: Point
  endControl?: Point
}

export interface LinkStrokeHit {
  linkId: LinkId
  t: number
  tangent: Point
}

interface RouteStop {
  point: Point
  dir?: Point
}

export function strandSpacing(connectionWidth: number): number {
  return connectionWidth + 1.5
}

function alongTie(angle: number): Point {
  return [Math.cos(angle), Math.sin(angle)]
}

function acrossTie(angle: number): Point {
  return [-Math.sin(angle), Math.cos(angle)]
}

export function tieHalfLength(tie: LinkTie, spacing: number): number {
  return ((tie.linkIds.length - 1) * spacing) / 2 + TIE_END_PAD
}

function strandPoint(tie: LinkTie, linkId: LinkId, spacing: number): Point {
  const rank = tie.linkIds.indexOf(linkId) - (tie.linkIds.length - 1) / 2
  const [nx, ny] = acrossTie(tie.angle)
  return [tie.pos[0] + nx * rank * spacing, tie.pos[1] + ny * rank * spacing]
}

function progressAlong(p: Readonly<Point>, a: Point, b: Point): number {
  return (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])
}

/** Splits the link from `a` (output) to `b` (input) into segments that pass through each of its ties in turn. */
export function routeThroughTies(
  ties: readonly LinkTie[],
  linkId: LinkId,
  a: Point,
  b: Point,
  startDir: LinkDirection,
  endDir: LinkDirection,
  spacing: number
): LinkTieSegment[] {
  const stops: RouteStop[] = ties
    .filter((tie) => tie.linkIds.includes(linkId))
    .sort((p, q) => progressAlong(p.pos, a, b) - progressAlong(q.pos, a, b))
    .map((tie) => ({
      point: strandPoint(tie, linkId, spacing),
      dir: alongTie(tie.angle)
    }))
  const route: RouteStop[] = [{ point: a }, ...stops, { point: b }]
  return route.slice(1).map((end, i) => {
    const start = route[i]
    const reach = distance(start.point, end.point) * CONTROL_FACTOR
    return {
      a: start.point,
      b: end.point,
      startDir: start.dir ? LinkDirection.CENTER : startDir,
      endDir: end.dir ? LinkDirection.CENTER : endDir,
      startControl: start.dir && [start.dir[0] * reach, start.dir[1] * reach],
      endControl: end.dir && [-end.dir[0] * reach, -end.dir[1] * reach]
    }
  })
}

/** The topmost tie whose strap contains the point, widened by `pad`. */
export function findLinkTieAt(
  ties: readonly LinkTie[],
  [x, y]: Point,
  spacing: number,
  pad: number
): LinkTie | undefined {
  return ties.findLast((tie) => {
    const dx = x - tie.pos[0]
    const dy = y - tie.pos[1]
    const [tx, ty] = alongTie(tie.angle)
    return (
      Math.abs(dx * tx + dy * ty) <= TIE_HALF_WIDTH + pad &&
      Math.abs(dy * tx - dx * ty) <= tieHalfLength(tie, spacing) + pad
    )
  })
}

function crossingAlong(
  p: Point,
  q: Point,
  r: LayoutPoint,
  s: LayoutPoint
): number | undefined {
  const d1x = q[0] - p[0]
  const d1y = q[1] - p[1]
  const d2x = s.x - r.x
  const d2y = s.y - r.y
  const det = d1x * d2y - d1y * d2x
  if (Math.abs(det) < 1e-9) return undefined
  const ex = r.x - p[0]
  const ey = r.y - p[1]
  const t = (ex * d2y - ey * d2x) / det
  const u = (ex * d1y - ey * d1x) / det
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : undefined
}

/** Ties whose strap the stroke from `p` to `q` crosses. */
export function tiesCrossedByStroke(
  ties: readonly LinkTie[],
  p: Point,
  q: Point,
  spacing: number
): LinkTie[] {
  return ties.filter((tie) => {
    const [nx, ny] = acrossTie(tie.angle)
    const h = tieHalfLength(tie, spacing)
    const [x, y] = tie.pos
    const ends = [
      { x: x - nx * h, y: y - ny * h },
      { x: x + nx * h, y: y + ny * h }
    ]
    return crossingAlong(p, q, ends[0], ends[1]) !== undefined
  })
}

/** Where the stroke from `p` to `q` first crosses each drawn link, with the link's direction there. */
export function strokeHits(
  polylines: Iterable<readonly [LinkId, readonly LayoutPoint[]]>,
  p: Point,
  q: Point
): LinkStrokeHit[] {
  const hits: LinkStrokeHit[] = []
  for (const [linkId, points] of polylines) {
    let first: LinkStrokeHit | undefined
    for (let i = 1; i < points.length; i++) {
      const r = points[i - 1]
      const s = points[i]
      const t = crossingAlong(p, q, r, s)
      if (t === undefined || (first && t >= first.t)) continue
      const length = Math.hypot(s.x - r.x, s.y - r.y) || 1
      first = {
        linkId,
        t,
        tangent: [(s.x - r.x) / length, (s.y - r.y) / length]
      }
    }
    if (first) hits.push(first)
  }
  return hits
}

/**
 * A tie centred on the stroke's crossings and turned to the links' mean direction.
 * Links already tied together keep their existing strand order.
 */
export function tieFromStroke(
  hits: readonly LinkStrokeHit[],
  p: Point,
  q: Point,
  ties: readonly LinkTie[]
): LinkTieDraft {
  const crossings = hits.map(
    ({ t }): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  )
  const tx = hits.reduce((sum, hit) => sum + hit.tangent[0], 0)
  const ty = hits.reduce((sum, hit) => sum + hit.tangent[1], 0)
  const angle = Math.hypot(tx, ty) > 1e-6 ? Math.atan2(ty, tx) : 0
  const [nx, ny] = acrossTie(angle)
  const sideways = new Map(
    hits.map(({ linkId }, i) => [
      linkId,
      crossings[i][0] * nx + crossings[i][1] * ny
    ])
  )
  const linkIds = hits.map((hit) => hit.linkId)
  const twin = ties.find((tie) =>
    linkIds.every((id) => tie.linkIds.includes(id))
  )
  const rank = (id: LinkId) =>
    twin ? twin.linkIds.indexOf(id) : (sideways.get(id) ?? 0)
  return {
    pos: [
      crossings.reduce((sum, [x]) => sum + x, 0) / crossings.length,
      crossings.reduce((sum, [, y]) => sum + y, 0) / crossings.length
    ],
    angle,
    linkIds: linkIds.sort((a, b) => rank(a) - rank(b))
  }
}
