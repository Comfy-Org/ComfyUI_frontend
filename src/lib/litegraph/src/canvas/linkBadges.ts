import { textOnColor } from '@/utils/colorUtil'

import type { Point, ReadOnlyRect, Rect } from '../interfaces'
import { LGraphBadge } from '../LGraphBadge'
import type { LinkId, LLink } from '../LLink'
import { overlapBounding } from '../measure'

const BADGE_GAP = 14
const BADGE_HEIGHT = 18
const BADGE_FONT_SIZE = 11
const CONNECTOR_WIDTH = 3
const BADGE_STACK_GAP = 4
const BADGE_CONNECT_INSET = 2

interface BadgeHitArea {
  linkId: LinkId
  x: number
  y: number
  width: number
  height: number
}

interface BadgeLayout {
  linkId: LinkId
  badge: LGraphBadge
  color: string
  width: number
  outputSocket: Point
  outputBadgeX: number
  outputBadgeY: number
  inputSocket: Point
  inputBadgeX: number
  inputBadgeY: number
}

export interface LinkBadgeFrameState {
  readonly hitAreas: BadgeHitArea[]
  readonly pendingBadges: BadgeLayout[]
}

export interface LinkBadgeTips {
  outputTip: Point
  inputTip: Point
}

export function createLinkBadgeFrameState(): LinkBadgeFrameState {
  return { hitAreas: [], pendingBadges: [] }
}

const frameStates = new WeakMap<object, LinkBadgeFrameState>()

/**
 * Per-canvas badge frame state, owned by this module rather than the canvas
 * (ADR 0008: no new state on the god object). Keyed weakly by the canvas.
 */
export function getLinkBadgeFrameState(host: object): LinkBadgeFrameState {
  const existing = frameStates.get(host)
  if (existing) return existing
  const created = createLinkBadgeFrameState()
  frameStates.set(host, created)
  return created
}

export function clearLinkBadgeFrameState(state: LinkBadgeFrameState): void {
  state.hitAreas.length = 0
  state.pendingBadges.length = 0
}

export function queryLinkBadgeAtPoint(
  state: LinkBadgeFrameState,
  x: number,
  y: number
): LinkId | undefined {
  return state.hitAreas.find(
    (area) =>
      x >= area.x &&
      x <= area.x + area.width &&
      y >= area.y &&
      y <= area.y + area.height
  )?.linkId
}

export function linkBadgeText(link: Pick<LLink, 'label' | 'type'>): string {
  const label = link.label?.trim()
  if (label) return label
  if (typeof link.type === 'number') return '*'
  return String(link.type ?? '') || '*'
}

function makeBadge(text: string, color: string): LGraphBadge {
  return new LGraphBadge({
    text,
    bgColor: color,
    fgColor: textOnColor(color),
    fontSize: BADGE_FONT_SIZE,
    height: BADGE_HEIGHT,
    cornerRadius: BADGE_HEIGHT / 2
  })
}

function overlapsBadge(
  left: number,
  top: number,
  width: number,
  area: BadgeHitArea
): boolean {
  return (
    left < area.x + area.width &&
    left + width > area.x &&
    top < area.y + area.height &&
    top + BADGE_HEIGHT > area.y
  )
}

function freeBadgeCenterY(
  hitAreas: readonly BadgeHitArea[],
  left: number,
  desiredCenterY: number,
  width: number
): number {
  let centerY = desiredCenterY
  let overlappingArea: BadgeHitArea | undefined
  do {
    const top = centerY - BADGE_HEIGHT / 2
    overlappingArea = hitAreas.find((area) =>
      overlapsBadge(left, top, width, area)
    )
    if (overlappingArea) {
      centerY =
        overlappingArea.y +
        overlappingArea.height +
        BADGE_STACK_GAP +
        BADGE_HEIGHT / 2
    }
  } while (overlappingArea)
  return centerY
}

function createHitArea(
  linkId: LinkId,
  left: number,
  centerY: number,
  width: number
): BadgeHitArea {
  return {
    linkId,
    x: left,
    y: centerY - BADGE_HEIGHT / 2,
    width,
    height: BADGE_HEIGHT
  }
}

function layoutHiddenLinkBadges(
  state: LinkBadgeFrameState,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): BadgeLayout {
  const text = linkBadgeText(link)

  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)
  const [outputSocketX, outputSocketY] = startPos
  const outputBadgeX = outputSocketX + BADGE_GAP
  const outputBadgeY = freeBadgeCenterY(
    state.hitAreas,
    outputBadgeX,
    outputSocketY,
    width
  )
  const outputHitArea = createHitArea(
    link.id,
    outputBadgeX,
    outputBadgeY,
    width
  )

  const [inputSocketX, inputSocketY] = endPos
  const inputBadgeX = inputSocketX - BADGE_GAP - width
  const inputBadgeY = freeBadgeCenterY(
    [...state.hitAreas, outputHitArea],
    inputBadgeX,
    inputSocketY,
    width
  )

  return {
    linkId: link.id,
    badge,
    color,
    width,
    outputSocket: startPos,
    outputBadgeX,
    outputBadgeY,
    inputSocket: endPos,
    inputBadgeX,
    inputBadgeY
  }
}

function getBadgeHitAreas(layout: BadgeLayout): [BadgeHitArea, BadgeHitArea] {
  return [
    createHitArea(
      layout.linkId,
      layout.outputBadgeX,
      layout.outputBadgeY,
      layout.width
    ),
    createHitArea(
      layout.linkId,
      layout.inputBadgeX,
      layout.inputBadgeY,
      layout.width
    )
  ]
}

function getBadgeBounds(
  layout: BadgeLayout,
  connectionPoints: readonly Point[]
): Rect {
  const hitAreas = getBadgeHitAreas(layout)
  let left = Math.min(...connectionPoints.map(([x]) => x))
  let top = Math.min(...connectionPoints.map(([, y]) => y))
  let right = Math.max(...connectionPoints.map(([x]) => x))
  let bottom = Math.max(...connectionPoints.map(([, y]) => y))

  for (const area of hitAreas) {
    left = Math.min(left, area.x)
    top = Math.min(top, area.y)
    right = Math.max(right, area.x + area.width)
    bottom = Math.max(bottom, area.y + area.height)
  }

  return [left, top, right - left, bottom - top]
}

function drawConnector(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = CONNECTOR_WIDTH
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from[0], from[1])
  ctx.lineTo(to[0], to[1])
  ctx.stroke()
  ctx.restore()
}

function drawBadgeLayout(
  ctx: CanvasRenderingContext2D,
  layout: BadgeLayout
): void {
  drawConnector(
    ctx,
    layout.outputSocket,
    [layout.outputBadgeX + BADGE_CONNECT_INSET, layout.outputBadgeY],
    layout.color
  )
  layout.badge.draw(
    ctx,
    layout.outputBadgeX,
    layout.outputBadgeY - BADGE_HEIGHT / 2
  )
  drawConnector(
    ctx,
    layout.inputSocket,
    [
      layout.inputBadgeX + layout.width - BADGE_CONNECT_INSET,
      layout.inputBadgeY
    ],
    layout.color
  )
  layout.badge.draw(
    ctx,
    layout.inputBadgeX,
    layout.inputBadgeY - BADGE_HEIGHT / 2
  )
}

export function enqueueHiddenLinkBadges(
  state: LinkBadgeFrameState,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  connectionPoints: readonly Point[],
  color: string,
  visibleArea: ReadOnlyRect
): LinkBadgeTips {
  const layout = layoutHiddenLinkBadges(
    state,
    ctx,
    link,
    connectionPoints[0],
    connectionPoints[connectionPoints.length - 1],
    color
  )
  const paint = overlapBounding(
    getBadgeBounds(layout, connectionPoints),
    visibleArea
  )
  return enqueueBadgeLayout(state, layout, paint)
}

/**
 * Hit areas are always recorded so stacking is viewport-independent (badges
 * keep their rows while panning); only painting is culled.
 */
function enqueueBadgeLayout(
  state: LinkBadgeFrameState,
  layout: BadgeLayout,
  paint: boolean
): LinkBadgeTips {
  state.hitAreas.push(...getBadgeHitAreas(layout))
  if (paint) state.pendingBadges.push(layout)
  return {
    outputTip: [layout.outputBadgeX + layout.width, layout.outputBadgeY],
    inputTip: [layout.inputBadgeX, layout.inputBadgeY]
  }
}

export function drawPendingLinkBadges(
  state: LinkBadgeFrameState,
  ctx: CanvasRenderingContext2D
): void {
  for (const layout of state.pendingBadges) drawBadgeLayout(ctx, layout)
  state.pendingBadges.length = 0
}
