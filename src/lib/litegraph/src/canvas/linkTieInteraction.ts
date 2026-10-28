import type {
  LGraph,
  LGraphCanvas
} from '@/lib/litegraph/src/types/entityRegistry'
import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import type { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { Point as LayoutPoint } from '@/renderer/core/layout/types'
import {
  deferLinkPolyline,
  getLinkPolyline,
  setLinkPolyline
} from '@/renderer/core/canvas/linkPolylines'
import { useLinkTieStore } from '@/stores/linkTieStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkTie } from '@/types/linkTie'

import {
  TIE_HALF_WIDTH,
  findLinkTieAt,
  routeThroughTies,
  strandSpacing,
  strokeHits,
  tieFromStroke,
  tieHalfLength,
  tiesCrossedByStroke
} from './linkTieGeometry'
import type { LinkTieSegment } from './linkTieGeometry'

const TIE_COLOUR = '#8c8c94'
const TIE_OUTLINE = 'rgba(0,0,0,0.6)'
const STROKE_COLOUR = '#ff3b3b'
const HEAD_HALF_WIDTH = 4
const HEAD_LENGTH = 6
const HIT_PAD_PX = 6

type LinkTieModifiers = Pick<
  MouseEvent,
  'button' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
>

const armedCanvases = new WeakSet<LGraphCanvas>()
const keyReleases = new WeakMap<LGraphCanvas, AbortController>()
const strokes = new WeakMap<LGraphCanvas, readonly [Point, Point]>()

/** Holding Z without modifiers arms the tie stroke on this canvas. */
export function trackLinkTieKey(canvas: LGraphCanvas, e: KeyboardEvent): void {
  if (e.code !== 'KeyZ') return
  const arms = e.type === 'keydown' && !e.ctrlKey && !e.metaKey && !e.altKey
  if (arms) armedCanvases.add(canvas)
  else armedCanvases.delete(canvas)
}

/** Disarms the canvas whenever its window loses focus or visibility, until {@link unbindLinkTieKey}. */
export function bindLinkTieKey(canvas: LGraphCanvas, view: Window): void {
  const controller = new AbortController()
  const disarm = () => armedCanvases.delete(canvas)
  view.addEventListener('blur', disarm, { signal: controller.signal })
  view.document.addEventListener('visibilitychange', disarm, {
    signal: controller.signal
  })
  keyReleases.set(canvas, controller)
}

export function unbindLinkTieKey(canvas: LGraphCanvas): void {
  keyReleases.get(canvas)?.abort()
  keyReleases.delete(canvas)
  armedCanvases.delete(canvas)
}

/** Whether a press starts a tie stroke: Z is held and no other modifier is down. */
export function isLinkTieStroke(
  canvas: LGraphCanvas,
  e: LinkTieModifiers
): boolean {
  return (
    armedCanvases.has(canvas) &&
    e.button === 0 &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey
  )
}

function linkTiesShown(canvas: LGraphCanvas): boolean {
  return canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK
}

/** The graph's ties with at least one member link drawn through them in the canvas's last frame. */
export function getVisibleLinkTies(
  canvas: LGraphCanvas,
  graph: LGraph
): readonly LinkTie[] {
  if (!linkTiesShown(canvas)) return []
  const { renderedPaths } = canvas
  return useLinkTieStore()
    .getTies(graphScopeOf(graph))
    .filter((tie) =>
      tie.linkIds.some((linkId) => {
        const link = graph.links.get(linkId)
        return (
          link !== undefined &&
          link.parentId === undefined &&
          renderedPaths.has(link)
        )
      })
    )
}

export function findLinkTieAtPoint(
  canvas: LGraphCanvas,
  graph: LGraph,
  point: Point
): LinkTie | undefined {
  return findLinkTieAt(
    getVisibleLinkTies(canvas, graph),
    point,
    strandSpacing(canvas.connections_width),
    HIT_PAD_PX / canvas.ds.scale
  )
}

function* tieablePolylines(canvas: LGraphCanvas) {
  for (const segment of canvas.renderedPaths) {
    if (!(segment instanceof LLink) || segment.parentId !== undefined) continue
    const polyline = getLinkPolyline(segment)
    if (polyline) yield [segment.id, polyline] as const
  }
}

function applyStroke(canvas: LGraphCanvas, from: Point, to: Point): void {
  const { graph } = canvas
  if (!graph || !linkTiesShown(canvas)) return
  const scope = graphScopeOf(graph)
  const store = useLinkTieStore()
  const ties = store.getTies(scope)
  const spacing = strandSpacing(canvas.connections_width)
  const visible = getVisibleLinkTies(canvas, graph)
  const cut = tiesCrossedByStroke(visible, from, to, spacing)
  for (const tie of cut) store.removeTie(scope, tie.id)
  if (cut.length) return
  const hits = strokeHits(tieablePolylines(canvas), from, to)
  if (hits.length) store.addTie(scope, tieFromStroke(hits, from, to, ties))
}

/** Claims the press for a stroke that ties the links it crosses, or cuts the ties it crosses. */
export function beginLinkTieStroke(
  canvas: LGraphCanvas,
  pointer: CanvasPointer,
  e: CanvasPointerEvent
): void {
  const from: Point = [e.canvasX, e.canvasY]
  pointer.onDrag = (eMove) => {
    if (!pointer.dragStarted) return
    strokes.set(canvas, [from, [eMove.canvasX, eMove.canvasY]])
    canvas.setDirty(false, true)
  }
  pointer.onDragEnd = (eUp) =>
    applyStroke(canvas, from, [eUp.canvasX, eUp.canvasY])
  pointer.finally = () => {
    strokes.delete(canvas)
    canvas.setDirty(false, true)
  }
}

/** Claims the press on a tie: dragging moves it, double-clicking removes it. */
export function beginLinkTieDrag(
  canvas: LGraphCanvas,
  graph: LGraph,
  pointer: CanvasPointer,
  tie: LinkTie,
  e: CanvasPointerEvent
): void {
  const scope = graphScopeOf(graph)
  const store = useLinkTieStore()
  const dx = tie.pos[0] - e.canvasX
  const dy = tie.pos[1] - e.canvasY
  const moveTo = ({ canvasX, canvasY }: CanvasPointerEvent) => {
    store.moveTie(scope, tie.id, [canvasX + dx, canvasY + dy])
    canvas.setDirty(false, true)
  }
  pointer.onDrag = (eMove) => {
    if (pointer.dragStarted) moveTo(eMove)
  }
  pointer.onDragEnd = moveTo
  pointer.onDoubleClick = () => {
    store.removeTie(scope, tie.id)
    canvas.setDirty(false, true)
  }
}

/** The segments of a link that passes through ties, or `undefined` for an untied link. */
export function routeLinkThroughTies(
  canvas: LGraphCanvas,
  linkTies: ReadonlyMap<LinkId, readonly LinkTie[]> | undefined,
  link: LLink,
  a: Point,
  b: Point,
  startDir: LinkDirection,
  endDir: LinkDirection
): LinkTieSegment[] | undefined {
  const ties = linkTies?.get(link.id)
  if (!ties) return
  const spacing = strandSpacing(canvas.connections_width)
  return routeThroughTies(ties, link.id, a, b, startDir, endDir, spacing)
}

/** Draws a tied link segment by segment, then publishes one hit path and one polyline for the whole route. */
export function renderTiedLink(
  canvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  segments: readonly LinkTieSegment[]
): void {
  const path = new Path2D()
  const polylines: (() => readonly LayoutPoint[])[] = []
  for (const segment of segments) {
    canvas.renderLink(
      ctx,
      segment.a,
      segment.b,
      link,
      false,
      0,
      null,
      segment.startDir,
      segment.endDir,
      segment
    )
    if (link.path) path.addPath(link.path)
    polylines.push(deferLinkPolyline(link))
  }
  link.path = path
  setLinkPolyline(link, () => polylines.flatMap((polyline) => polyline()))
}

function drawTie(
  ctx: CanvasRenderingContext2D,
  tie: LinkTie,
  spacing: number
): void {
  const h = tieHalfLength(tie, spacing)
  ctx.save()
  ctx.translate(tie.pos[0], tie.pos[1])
  ctx.rotate(tie.angle)
  ctx.beginPath()
  ctx.roundRect(-TIE_HALF_WIDTH, -h, TIE_HALF_WIDTH * 2, h * 2, TIE_HALF_WIDTH)
  ctx.roundRect(
    -HEAD_HALF_WIDTH,
    -h - HEAD_LENGTH + 1,
    HEAD_HALF_WIDTH * 2,
    HEAD_LENGTH,
    1.5
  )
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** Draws the ties over their links, and the tie stroke while one is in progress. */
export function drawLinkTies(
  ctx: CanvasRenderingContext2D,
  canvas: LGraphCanvas,
  ties: readonly LinkTie[]
): void {
  const spacing = strandSpacing(canvas.connections_width)
  ctx.save()
  ctx.fillStyle = TIE_COLOUR
  ctx.strokeStyle = TIE_OUTLINE
  ctx.lineWidth = 1
  for (const tie of ties) drawTie(ctx, tie, spacing)
  const stroke = strokes.get(canvas)
  if (stroke) {
    ctx.strokeStyle = STROKE_COLOUR
    ctx.lineWidth = 2 / canvas.ds.scale
    ctx.beginPath()
    ctx.moveTo(...stroke[0])
    ctx.lineTo(...stroke[1])
    ctx.stroke()
  }
  ctx.restore()
}
