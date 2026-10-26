import type {
  LGraph,
  LGraphCanvas
} from '@/lib/litegraph/src/types/entityRegistry'
import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { Point as LayoutPoint } from '@/renderer/core/layout/types'
import {
  getLinkPolyline,
  setLinkPolyline
} from '@/renderer/core/canvas/linkPolylines'
import { useLinkTieStore } from '@/stores/linkTieStore'
import { graphScopeOf } from '@/types/graphScopeId'
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

const TIE_COLOUR = '#8c8c94'
const TIE_OUTLINE = 'rgba(0,0,0,0.6)'
const STROKE_COLOUR = '#ff3b3b'
const HEAD_HALF_WIDTH = 4
const HEAD_LENGTH = 6
const HIT_PAD_PX = 6

const armedCanvases = new WeakSet<LGraphCanvas>()
const strokes = new WeakMap<LGraphCanvas, readonly [Point, Point]>()

/** Holding Z without modifiers arms the tie stroke on this canvas. */
export function trackLinkTieKey(canvas: LGraphCanvas, e: KeyboardEvent): void {
  if (e.code !== 'KeyZ') return
  const arms = e.type === 'keydown' && !e.ctrlKey && !e.metaKey && !e.altKey
  if (arms) armedCanvases.add(canvas)
  else armedCanvases.delete(canvas)
}

export function isLinkTieKeyHeld(canvas: LGraphCanvas): boolean {
  return armedCanvases.has(canvas)
}

function tiesOf(graph: LGraph): readonly LinkTie[] {
  return useLinkTieStore().getTies(graphScopeOf(graph))
}

export function findLinkTieAtPoint(
  canvas: LGraphCanvas,
  graph: LGraph,
  point: Point
): LinkTie | undefined {
  return findLinkTieAt(
    tiesOf(graph),
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
  if (!graph) return
  const scope = graphScopeOf(graph)
  const store = useLinkTieStore()
  const ties = store.getTies(scope)
  const spacing = strandSpacing(canvas.connections_width)
  const cut = tiesCrossedByStroke(ties, from, to, spacing)
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
  pointer.onDrag = (eMove) => {
    store.moveTie(scope, tie.id, [eMove.canvasX + dx, eMove.canvasY + dy])
    canvas.setDirty(false, true)
  }
  pointer.onDoubleClick = () => {
    store.removeTie(scope, tie.id)
    canvas.setDirty(false, true)
  }
}

/** Draws the link through each of its ties; the output-side segment draws last so it keeps the link's hit path. */
export function renderLinkThroughTies(
  canvas: LGraphCanvas,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  graph: LGraph,
  a: Point,
  b: Point,
  startDir: LinkDirection,
  endDir: LinkDirection
): void {
  const ties = tiesOf(graph)
  if (!ties.some((tie) => tie.linkIds.includes(link.id))) {
    canvas.renderLink(ctx, a, b, link, false, 0, null, startDir, endDir)
    return
  }
  const inputSideFirst = routeThroughTies(
    ties,
    link.id,
    a,
    b,
    startDir,
    endDir,
    strandSpacing(canvas.connections_width)
  ).reverse()
  const polylines: (readonly LayoutPoint[])[] = []
  for (const segment of inputSideFirst) {
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
    polylines.unshift(getLinkPolyline(link) ?? [])
  }
  setLinkPolyline(link, () => polylines.flat())
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

/** Draws the graph's ties over its links, and the tie stroke while one is in progress. */
export function drawLinkTies(
  ctx: CanvasRenderingContext2D,
  canvas: LGraphCanvas,
  graph: LGraph
): void {
  const spacing = strandSpacing(canvas.connections_width)
  ctx.save()
  ctx.fillStyle = TIE_COLOUR
  ctx.strokeStyle = TIE_OUTLINE
  ctx.lineWidth = 1
  for (const tie of tiesOf(graph)) drawTie(ctx, tie, spacing)
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
