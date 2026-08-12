import { textOnColor } from '@/utils/colorUtil'

import type { Point } from '../interfaces'
import { LGraphBadge } from '../LGraphBadge'
import type { LinkId, LLink } from '../LLink'

const BADGE_GAP = 14
const BADGE_HEIGHT = 18
const BADGE_FONT_SIZE = 11
const CONNECTOR_WIDTH = 3
const BADGE_STACK_GAP = 4
const BADGE_CONNECT_INSET = 2

export interface BadgeHitArea {
  linkId: LinkId
  x: number
  y: number
  width: number
  height: number
}

interface BadgeLayout {
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
  return link.type == null ? '' : String(link.type)
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
  state: LinkBadgeFrameState,
  left: number,
  desiredCenterY: number,
  width: number
): number {
  let centerY = desiredCenterY
  let overlappingArea: BadgeHitArea | undefined
  do {
    const top = centerY - BADGE_HEIGHT / 2
    overlappingArea = state.hitAreas.find((area) =>
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

function recordHitArea(
  state: LinkBadgeFrameState,
  linkId: LinkId,
  left: number,
  centerY: number,
  width: number
): void {
  state.hitAreas.push({
    linkId,
    x: left,
    y: centerY - BADGE_HEIGHT / 2,
    width,
    height: BADGE_HEIGHT
  })
}

function layoutHiddenLinkBadges(
  state: LinkBadgeFrameState,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): BadgeLayout | undefined {
  const text = linkBadgeText(link)
  if (!text) return

  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)
  const [outputSocketX, outputSocketY] = startPos
  const outputBadgeX = outputSocketX + BADGE_GAP
  const outputBadgeY = freeBadgeCenterY(
    state,
    outputBadgeX,
    outputSocketY,
    width
  )
  recordHitArea(state, link.id, outputBadgeX, outputBadgeY, width)

  const [inputSocketX, inputSocketY] = endPos
  const inputBadgeX = inputSocketX - BADGE_GAP - width
  const inputBadgeY = freeBadgeCenterY(state, inputBadgeX, inputSocketY, width)
  recordHitArea(state, link.id, inputBadgeX, inputBadgeY, width)

  return {
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
  startPos: Point,
  endPos: Point,
  color: string
): LinkBadgeTips | undefined {
  const layout = layoutHiddenLinkBadges(
    state,
    ctx,
    link,
    startPos,
    endPos,
    color
  )
  if (!layout) return
  state.pendingBadges.push(layout)
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
