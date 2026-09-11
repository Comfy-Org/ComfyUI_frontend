import { textOnColor } from '@/utils/colorUtil'

import type { HasBoundingRect, Point, ReadOnlyRect, Rect } from '../interfaces'
import { LGraphBadge } from '../LGraphBadge'
import type { LLink } from '../LLink'
import type { LinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'
import { compareNodeIds } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { overlapBounding } from '../measure'

export const BADGE_GAP = 14
const BADGE_HEIGHT = 18
const BADGE_FONT_SIZE = 11
const CONNECTOR_WIDTH = 3
const BADGE_STACK_GAP = 4
const BADGE_CONNECT_INSET = 2

interface BadgeHitArea extends HasBoundingRect {
  readonly linkId: LinkId
  readonly boundingRect: Rect
}

export interface HiddenLinkBadge {
  link: LLink
  presentation: Readonly<LinkPresentation>
  startPos: Point
  endPos: Point
  color: string
}

interface LinkBadgePair {
  badge: LGraphBadge
  color: string
  output: BadgeEndpoint
  input: BadgeEndpoint
}

interface BadgeEndpoint {
  nodeId: NodeId
  slot: number
  side: 'input' | 'output'
  socket: Point
  hitArea: BadgeHitArea
  tip: Point
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
  return hitAreasByHost.get(host)?.find(({ boundingRect }) => {
    const [left, top, width, height] = boundingRect
    return x >= left && x <= left + width && y >= top && y <= top + height
  })?.linkId
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
  const [areaLeft, areaTop, areaWidth, areaHeight] = area.boundingRect
  return (
    left < areaLeft + areaWidth &&
    left + width > areaLeft &&
    top < areaTop + areaHeight &&
    top + BADGE_HEIGHT > areaTop
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
      const [, top, , height] = overlappingArea.boundingRect
      centerY = top + height + BADGE_STACK_GAP + BADGE_HEIGHT / 2
    }
  } while (overlappingArea)
  return centerY
}

function createBadgeEndpoint(
  link: LLink,
  side: BadgeEndpoint['side'],
  socket: Point,
  width: number
): BadgeEndpoint {
  const isOutput = side === 'output'
  const left = isOutput ? socket[0] + BADGE_GAP : socket[0] - BADGE_GAP - width
  return {
    nodeId: isOutput ? link.origin_id : link.target_id,
    slot: isOutput ? link.origin_slot : link.target_slot,
    side,
    socket,
    hitArea: {
      linkId: link.id,
      boundingRect: [left, socket[1] - BADGE_HEIGHT / 2, width, BADGE_HEIGHT]
    },
    tip: [isOutput ? left + width : left, socket[1]]
  }
}

function compareBadgeEndpoints(
  first: BadgeEndpoint,
  second: BadgeEndpoint
): number {
  const nodeOrder = compareNodeIds(first.nodeId, second.nodeId)
  if (nodeOrder) return nodeOrder
  if (first.side !== second.side) return first.side === 'output' ? -1 : 1
  return (
    first.socket[1] - second.socket[1] ||
    first.slot - second.slot ||
    first.hitArea.linkId - second.hitArea.linkId
  )
}

export function layoutHiddenLinkBadges(
  host: object,
  ctx: CanvasRenderingContext2D,
  hiddenLinks: readonly HiddenLinkBadge[]
): Map<LinkId, LinkBadgePair> {
  const layouts = new Map<LinkId, LinkBadgePair>()
  const endpoints: BadgeEndpoint[] = []
  for (const { link, presentation, startPos, endPos, color } of hiddenLinks) {
    const badge = makeBadge(linkBadgeText(link.type, presentation), color)
    const width = badge.getWidth(ctx)
    const output = createBadgeEndpoint(link, 'output', startPos, width)
    const input = createBadgeEndpoint(link, 'input', endPos, width)
    layouts.set(link.id, { badge, color, output, input })
    endpoints.push(output, input)
  }
  endpoints.sort(compareBadgeEndpoints)

  const hitAreas: BadgeHitArea[] = []
  for (const { hitArea, socket, tip } of endpoints) {
    const [left, , width] = hitArea.boundingRect
    const centerY = freeBadgeCenterY(hitAreas, left, socket[1], width)
    hitArea.boundingRect[1] = centerY - BADGE_HEIGHT / 2
    tip[1] = centerY
    hitAreas.push(hitArea)
  }
  hitAreasByHost.set(host, hitAreas)
  return layouts
}

function getConnectorBounds(socket: Point, area: BadgeHitArea): Rect {
  const [areaLeft, areaTop, width, height] = area.boundingRect
  const left = Math.min(socket[0], areaLeft)
  const top = Math.min(socket[1], areaTop)
  const right = Math.max(socket[0], areaLeft + width)
  const bottom = Math.max(socket[1], areaTop + height)
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

export function drawHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  layout: LinkBadgePair,
  visibleArea: ReadOnlyRect
): void {
  const endpoints = [layout.output, layout.input]
  const visible = endpoints.some(({ socket, hitArea }) =>
    overlapBounding(getConnectorBounds(socket, hitArea), visibleArea)
  )
  if (!visible) return

  for (const { side, socket, hitArea } of endpoints) {
    const [left, top, width, height] = hitArea.boundingRect
    const connectorX =
      side === 'output'
        ? left + BADGE_CONNECT_INSET
        : left + width - BADGE_CONNECT_INSET
    drawConnector(ctx, socket, [connectorX, top + height / 2], layout.color)
    layout.badge.draw(ctx, left, top)
  }
}
