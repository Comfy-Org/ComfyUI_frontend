import { textOnColor } from '@/utils/colorUtil'

import type { HasBoundingRect, Point, ReadOnlyRect, Rect } from '../interfaces'
import { LGraphBadge } from '../LGraphBadge'
import type { LLink } from '../LLink'
import type { LinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'
import { compareNodeIds } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { overlapBounding } from '../measure'
import { slotTypeKey } from '../utils/type'

export const BADGE_GAP = 14
const BADGE_HEIGHT = 18
const BADGE_FONT_SIZE = 11
const CONNECTOR_WIDTH = 3
const BADGE_STACK_GAP = 4
export const BADGE_ROW_PITCH = BADGE_HEIGHT + BADGE_STACK_GAP
const BADGE_CONNECT_INSET = 2
const STACK_LAYER_OFFSET = 3
const MAX_STACK_LAYERS = 2

type BadgeSide = 'input' | 'output'

interface BadgeHitArea extends HasBoundingRect {
  readonly linkIds: readonly LinkId[]
  readonly stackKey?: string
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
  output: BadgeEndpoint
  input: BadgeEndpoint
}

const BADGE_RANK = { stackHead: 0, unlabelled: 1, labelled: 2 } as const

type BadgeRank = (typeof BADGE_RANK)[keyof typeof BADGE_RANK]

interface BadgeEndpoint {
  nodeId: NodeId
  slot: number
  side: BadgeSide
  rank: BadgeRank
  socket: Point
  badge: LGraphBadge
  color: string
  width: number
  layers: number
  hitArea: BadgeHitArea
  tip: Point
}

const endpointsByHost = new WeakMap<object, BadgeEndpoint[]>()
const expandedStacksByHost = new WeakMap<object, Set<string>>()
const drawnStackKeysByHost = new WeakMap<object, Set<string>>()

export function clearLinkBadgeHitAreas(host: object): void {
  endpointsByHost.delete(host)
  drawnStackKeysByHost.delete(host)
}

function containsPoint([left, top, width, height]: Rect, x: number, y: number) {
  return x >= left && x <= left + width && y >= top && y <= top + height
}

/** The badge hit area under a canvas point: one link, or a stack of links. */
export function queryLinkBadgeHitAtPoint(
  host: object,
  x: number,
  y: number
): Readonly<BadgeHitArea> | undefined {
  return endpointsByHost
    .get(host)
    ?.find(({ hitArea }) => containsPoint(hitArea.boundingRect, x, y))?.hitArea
}

export function queryLinkBadgeAtPoint(
  host: object,
  x: number,
  y: number
): LinkId | undefined {
  const hit = queryLinkBadgeHitAtPoint(host, x, y)
  return hit && !hit.stackKey ? hit.linkIds[0] : undefined
}

export function toggleLinkBadgeStack(host: object, stackKey: string): void {
  const expanded = expandedStacksByHost.get(host) ?? new Set<string>()
  if (!expanded.delete(stackKey)) expanded.add(stackKey)
  expandedStacksByHost.set(host, expanded)
}

/** Collapses every expanded stack on the host; returns whether one was on screen. */
export function collapseLinkBadgeStacks(host: object): boolean {
  const expanded = expandedStacksByHost.get(host)
  expandedStacksByHost.delete(host)
  const drawn = drawnStackKeysByHost.get(host)
  return [...(expanded ?? [])].some((stackKey) => drawn?.has(stackKey))
}

function linkTypeText(type: LLink['type']): string {
  if (typeof type === 'number') return '*'
  return String(slotTypeKey(type) || '*')
}

function stackTypeText(
  linkIds: readonly LinkId[],
  typeTextByLinkId: ReadonlyMap<LinkId, string>
): string {
  const types = new Set(linkIds.map((linkId) => typeTextByLinkId.get(linkId)))
  const [type] = types
  return types.size === 1 && type ? type : '*'
}

export function linkBadgeText(
  type: LLink['type'],
  presentation: Readonly<LinkPresentation>
): string {
  return presentation.label?.trim() || linkTypeText(type)
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
  [width, height]: readonly [number, number],
  area: BadgeHitArea
): boolean {
  const [areaLeft, areaTop, areaWidth, areaHeight] = area.boundingRect
  return (
    left < areaLeft + areaWidth &&
    left + width > areaLeft &&
    top < areaTop + areaHeight &&
    top + height > areaTop
  )
}

function freeBadgeCenterY(
  hitAreas: readonly BadgeHitArea[],
  left: number,
  desiredCenterY: number,
  size: readonly [number, number]
): number {
  let centerY = desiredCenterY
  let overlappingArea: BadgeHitArea | undefined
  do {
    const top = centerY - BADGE_HEIGHT / 2
    overlappingArea = hitAreas.find((area) =>
      overlapsBadge(left, top, size, area)
    )
    if (overlappingArea) {
      const [, top, , height] = overlappingArea.boundingRect
      centerY = top + height + BADGE_STACK_GAP + BADGE_HEIGHT / 2
    }
  } while (overlappingArea)
  return centerY
}

function socketOf(link: LLink, side: BadgeSide) {
  return side === 'output'
    ? { nodeId: link.origin_id, slot: link.origin_slot }
    : { nodeId: link.target_id, slot: link.target_slot }
}

function stackKeyOf(link: LLink, side: BadgeSide): string {
  const { nodeId, slot } = socketOf(link, side)
  return `${side}:${nodeId}:${slot}`
}

function isUnlabelled({ presentation }: HiddenLinkBadge): boolean {
  return !presentation.label?.trim()
}

function groupStackedLinks(
  hiddenLinks: readonly HiddenLinkBadge[]
): Map<string, LinkId[]> {
  const groups = new Map<string, LinkId[]>()
  for (const hidden of hiddenLinks.filter(isUnlabelled)) {
    for (const side of ['output', 'input'] as const) {
      const key = stackKeyOf(hidden.link, side)
      const group = groups.get(key)
      if (group) group.push(hidden.link.id)
      else groups.set(key, [hidden.link.id])
    }
  }
  for (const [key, linkIds] of groups) {
    if (linkIds.length < 2) groups.delete(key)
  }
  return groups
}

interface EndpointSpec {
  link: LLink
  side: BadgeSide
  rank: BadgeRank
  socket: Point
  text: string
  color: string
  linkIds: readonly LinkId[]
  stackKey?: string
  layers?: number
}

function createBadgeEndpoint(
  ctx: CanvasRenderingContext2D,
  spec: EndpointSpec
): BadgeEndpoint {
  const { link, side, rank, socket, text, color, linkIds, stackKey } = spec
  const layers = spec.layers ?? 0
  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)
  const layerExtent = layers * STACK_LAYER_OFFSET
  const isOutput = side === 'output'
  const left = isOutput
    ? socket[0] + BADGE_GAP
    : socket[0] - BADGE_GAP - width - layerExtent
  return {
    ...socketOf(link, side),
    side,
    rank,
    socket,
    badge,
    color,
    width,
    layers,
    hitArea: {
      linkIds,
      stackKey,
      boundingRect: [
        left,
        socket[1] - BADGE_HEIGHT / 2,
        width + layerExtent,
        BADGE_HEIGHT + layerExtent
      ]
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
    first.rank - second.rank ||
    first.hitArea.linkIds[0] - second.hitArea.linkIds[0]
  )
}

export function layoutHiddenLinkBadges(
  host: object,
  ctx: CanvasRenderingContext2D,
  hiddenLinks: readonly HiddenLinkBadge[]
): Map<LinkId, LinkBadgePair> {
  const stacks = groupStackedLinks(hiddenLinks)
  const expanded = expandedStacksByHost.get(host)
  for (const stackKey of expanded ?? []) {
    if (!stacks.has(stackKey)) expanded?.delete(stackKey)
  }

  const layouts = new Map<LinkId, LinkBadgePair>()
  const endpoints: BadgeEndpoint[] = []
  const stackHeads = new Map<string, BadgeEndpoint>()
  const typeTextByLinkId = new Map(
    hiddenLinks.map(({ link }) => [link.id, linkTypeText(link.type)])
  )
  const addEndpoint = (spec: EndpointSpec) => {
    const endpoint = createBadgeEndpoint(ctx, spec)
    endpoints.push(endpoint)
    return endpoint
  }
  const stackHead = (spec: EndpointSpec, stackKey: string) => {
    const existing = stackHeads.get(stackKey)
    if (existing) return existing
    const linkIds = stacks.get(stackKey) ?? []
    const head = addEndpoint({
      ...spec,
      rank: BADGE_RANK.stackHead,
      text: `${stackTypeText(linkIds, typeTextByLinkId)} ×${linkIds.length}`,
      linkIds,
      stackKey,
      layers: expanded?.has(stackKey)
        ? 0
        : Math.min(linkIds.length - 1, MAX_STACK_LAYERS)
    })
    stackHeads.set(stackKey, head)
    return head
  }
  const placeEndpoint = (
    hidden: HiddenLinkBadge,
    side: BadgeSide,
    socket: Point
  ) => {
    const { link, presentation, color } = hidden
    const spec: EndpointSpec = {
      link,
      side,
      socket,
      color,
      rank: isUnlabelled(hidden) ? BADGE_RANK.unlabelled : BADGE_RANK.labelled,
      text: linkBadgeText(link.type, presentation),
      linkIds: [link.id]
    }
    const stackKey = stackKeyOf(link, side)
    if (!isUnlabelled(hidden) || !stacks.has(stackKey)) return addEndpoint(spec)
    const head = stackHead(spec, stackKey)
    return expanded?.has(stackKey) ? addEndpoint(spec) : head
  }

  for (const hidden of hiddenLinks) {
    layouts.set(hidden.link.id, {
      output: placeEndpoint(hidden, 'output', hidden.startPos),
      input: placeEndpoint(hidden, 'input', hidden.endPos)
    })
  }
  endpoints.sort(compareBadgeEndpoints)

  const hitAreas: BadgeHitArea[] = []
  let previousEndpoint: BadgeEndpoint | undefined
  for (const endpoint of endpoints) {
    const { hitArea, socket, tip, nodeId, side } = endpoint
    const [left, , width, height] = hitArea.boundingRect
    const desiredCenterY =
      previousEndpoint?.nodeId === nodeId && previousEndpoint.side === side
        ? Math.max(socket[1], previousEndpoint.tip[1])
        : socket[1]
    const centerY = freeBadgeCenterY(hitAreas, left, desiredCenterY, [
      width,
      height
    ])
    hitArea.boundingRect[1] = centerY - BADGE_HEIGHT / 2
    tip[1] = centerY
    hitAreas.push(hitArea)
    previousEndpoint = endpoint
  }
  endpointsByHost.set(host, endpoints)
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

function drawStackLayers(
  ctx: CanvasRenderingContext2D,
  { layers, width, color }: BadgeEndpoint,
  left: number,
  top: number
): void {
  ctx.save()
  const baseAlpha = ctx.globalAlpha
  ctx.fillStyle = color
  ctx.strokeStyle = textOnColor(color)
  ctx.lineWidth = 1
  for (let layer = layers; layer > 0; layer--) {
    const offset = layer * STACK_LAYER_OFFSET
    ctx.globalAlpha = baseAlpha * (1 - layer * 0.25)
    ctx.beginPath()
    ctx.roundRect(left + offset, top + offset, width, BADGE_HEIGHT, [
      BADGE_HEIGHT / 2
    ])
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

function drawBadgeEndpoint(
  ctx: CanvasRenderingContext2D,
  endpoint: BadgeEndpoint
): void {
  const { side, socket, hitArea, width, badge, color } = endpoint
  const [left, top] = hitArea.boundingRect
  const connectorX =
    side === 'output'
      ? left + BADGE_CONNECT_INSET
      : left + width - BADGE_CONNECT_INSET
  drawConnector(ctx, socket, [connectorX, top + BADGE_HEIGHT / 2], color)
  drawStackLayers(ctx, endpoint, left, top)
  badge.draw(ctx, left, top)
}

/** Draws the badges from the host's last layout that touch the visible area. */
export function drawHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  host: object,
  visibleArea: ReadOnlyRect
): void {
  const drawnStackKeys = new Set<string>()
  for (const endpoint of endpointsByHost.get(host) ?? []) {
    const bounds = getConnectorBounds(endpoint.socket, endpoint.hitArea)
    if (!overlapBounding(bounds, visibleArea)) continue
    drawBadgeEndpoint(ctx, endpoint)
    if (endpoint.hitArea.stackKey) drawnStackKeys.add(endpoint.hitArea.stackKey)
  }
  drawnStackKeysByHost.set(host, drawnStackKeys)
}
