import { textOnColor } from '@/utils/colorUtil'

import type { Point, ReadOnlyRect, Rect } from '../interfaces'
import { LGraphBadge } from '../LGraphBadge'
import type { LLink } from '../LLink'
import type { LinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'
import { overlapBounding } from '../measure'

export const BADGE_GAP = 14
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

export interface LinkBadgeLayout {
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
  outputTip: Point
  inputTip: Point
}

const hitAreasByHost = new WeakMap<object, BadgeHitArea[]>()

export function clearLinkBadgeHitAreas(host: object): void {
  hitAreasByHost.delete(host)
}

export function queryLinkBadgeAtPoint(
  host: object,
  x: number,
  y: number
): LinkId | undefined {
  return hitAreasByHost
    .get(host)
    ?.find(
      (area) =>
        x >= area.x &&
        x <= area.x + area.width &&
        y >= area.y &&
        y <= area.y + area.height
    )?.linkId
}

export function linkBadgeText(
  type: LLink['type'],
  presentation: Readonly<LinkPresentation>
): string {
  const label = presentation.label?.trim()
  if (label) return label
  if (typeof type === 'number') return '*'
  return type || '*'
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

export function layoutHiddenLinkBadges(
  host: object,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  presentation: Readonly<LinkPresentation>,
  startPos: Point,
  endPos: Point,
  color: string
): LinkBadgeLayout {
  const hitAreas = hitAreasByHost.get(host) ?? []
  const text = linkBadgeText(link.type, presentation)

  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)
  const [outputSocketX, outputSocketY] = startPos
  const outputBadgeX = outputSocketX + BADGE_GAP
  const outputBadgeY = freeBadgeCenterY(
    hitAreas,
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
    [...hitAreas, outputHitArea],
    inputBadgeX,
    inputSocketY,
    width
  )

  const layout: LinkBadgeLayout = {
    linkId: link.id,
    badge,
    color,
    width,
    outputSocket: startPos,
    outputBadgeX,
    outputBadgeY,
    inputSocket: endPos,
    inputBadgeX,
    inputBadgeY,
    outputTip: [outputBadgeX + width, outputBadgeY],
    inputTip: [inputBadgeX, inputBadgeY]
  }
  hitAreas.push(...getBadgeHitAreas(layout))
  hitAreasByHost.set(host, hitAreas)
  return layout
}

function getBadgeHitAreas(
  layout: LinkBadgeLayout
): [BadgeHitArea, BadgeHitArea] {
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

function getConnectorBounds(socket: Point, area: BadgeHitArea): Rect {
  const left = Math.min(socket[0], area.x)
  const top = Math.min(socket[1], area.y)
  const right = Math.max(socket[0], area.x + area.width)
  const bottom = Math.max(socket[1], area.y + area.height)
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
  layout: LinkBadgeLayout
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

export function drawHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  layout: LinkBadgeLayout,
  visibleArea: ReadOnlyRect
): void {
  const endpointHitAreas = getBadgeHitAreas(layout)
  if (
    overlapBounding(
      getConnectorBounds(layout.outputSocket, endpointHitAreas[0]),
      visibleArea
    ) ||
    overlapBounding(
      getConnectorBounds(layout.inputSocket, endpointHitAreas[1]),
      visibleArea
    )
  ) {
    drawBadgeLayout(ctx, layout)
  }
}
