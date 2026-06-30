import { textOnColor } from '@/utils/colorUtil'

import { LGraphBadge } from '../LGraphBadge'
import type { LinkId, LLink } from '../LLink'
import type { Point } from '../interfaces'
import type { CanvasPointerEvent } from '../types/events'

/** Gap in graph units between a socket and the start of its badge. */
const BADGE_GAP = 14
const BADGE_HEIGHT = 18
const BADGE_FONT_SIZE = 11
/** Width of the short stub that connects a socket to its badge. */
const CONNECTOR_WIDTH = 3
/** Vertical gap kept between badges that would otherwise overlap in a column. */
const BADGE_STACK_GAP = 4
/**
 * How far the connector stub reaches past the badge's edge so the badge fill
 * covers the join — just enough to stay clean when a stacked badge sits below
 * its socket and the stub runs at an angle.
 */
const BADGE_CONNECT_INSET = 2

interface BadgeHitArea {
  linkId: LinkId
  x: number
  y: number
  width: number
  height: number
}

/**
 * Hit areas for the badges drawn this frame, in graph coordinates. Rebuilt every
 * render pass (cleared at the start of `drawConnections`) and queried by pointer
 * handlers. Module-level so the canvas god-object gains no new render state.
 */
const hitAreas: BadgeHitArea[] = []

interface PendingBadge {
  link: LLink
  startPos: Point
  endPos: Point
  color: string
}

/**
 * Badges queued during the link pass and drawn afterwards, so every badge sits
 * above the noodles (e.g. a hovered link's revealed curve). Reset each frame.
 */
const pendingBadges: PendingBadge[] = []

/** Links whose noodle is currently revealed (badge or socket hover). */
const revealedLinkIds = new Set<LinkId>()

export function clearLinkBadgeHitAreas(): void {
  hitAreas.length = 0
  pendingBadges.length = 0
}

/** Returns the id of a hidden link whose badge contains the point, if any. */
export function queryLinkBadgeAtPoint(
  x: number,
  y: number
): LinkId | undefined {
  for (const area of hitAreas) {
    if (
      x >= area.x &&
      x <= area.x + area.width &&
      y >= area.y &&
      y <= area.y + area.height
    ) {
      return area.linkId
    }
  }
  return undefined
}

/**
 * Sets the links whose noodle should be revealed (the pointer is over a badge or
 * a socket they connect to). Returns `true` only when the set changed, so
 * callers can skip redundant redraws.
 */
export function setRevealedLinks(linkIds: Iterable<LinkId>): boolean {
  const next = new Set(linkIds)
  if (
    next.size === revealedLinkIds.size &&
    [...next].every((id) => revealedLinkIds.has(id))
  ) {
    return false
  }
  revealedLinkIds.clear()
  for (const id of next) revealedLinkIds.add(id)
  return true
}

/** Whether the given hidden link's noodle is currently revealed. */
export function isLinkRevealed(linkId: LinkId): boolean {
  return revealedLinkIds.has(linkId)
}

/** The text shown on a hidden link's badges: its custom label or its type. */
export function linkBadgeText(link: Pick<LLink, 'label' | 'type'>): string {
  const label = link.label?.trim()
  if (label) return label
  return link.type != null ? String(link.type) : ''
}

/** Minimal canvas surface needed to rename a badge, to avoid a circular import. */
interface BadgeRenameHost {
  prompt(
    title: string,
    value: string | number,
    callback: (value: string) => void,
    event: CanvasPointerEvent
  ): unknown
  setDirty(fgcanvas: boolean, bgcanvas: boolean): void
  emitBeforeChange(): void
  emitAfterChange(): void
}

/** Opens the inline editor to rename a hidden link's badges, then redraws. */
export function promptRenameLinkBadge(
  host: BadgeRenameHost,
  link: LLink,
  event: CanvasPointerEvent
): void {
  host.prompt(
    'Rename',
    linkBadgeText(link),
    (value) => {
      const trimmed = value.trim()
      host.emitBeforeChange()
      link.label = trimmed.length ? trimmed : undefined
      host.setDirty(false, true)
      host.emitAfterChange()
    },
    event
  )
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

/** Strokes the short connector stub between a socket and its badge edge. */
function drawConnectorStub(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string
): void {
  const { strokeStyle, lineWidth, lineCap } = ctx
  ctx.strokeStyle = color
  ctx.lineWidth = CONNECTOR_WIDTH
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from[0], from[1])
  ctx.lineTo(to[0], to[1])
  ctx.stroke()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = lineCap
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

/**
 * Centre Y for a badge of `width` whose left edge sits at `left`, starting at its
 * socket row (`desiredCentreY`) and sliding downward only as far as needed to
 * clear every badge already placed this frame. This stacks badges that share a
 * socket and keeps them off the labels of nearby sockets.
 */
function freeBadgeCentreY(
  left: number,
  desiredCentreY: number,
  width: number
): number {
  let centreY = desiredCentreY
  let moved = true
  while (moved) {
    moved = false
    const top = centreY - BADGE_HEIGHT / 2
    for (const area of hitAreas) {
      if (overlapsBadge(left, top, width, area)) {
        centreY = area.y + area.height + BADGE_STACK_GAP + BADGE_HEIGHT / 2
        moved = true
        break
      }
    }
  }
  return centreY
}

/**
 * Draws a hidden link's two end badges — one just past the output socket, one
 * just before the input socket — both filled with the link/socket `color` and
 * joined to their socket by a short connector stub, and records their hit areas
 * for {@link queryLinkBadgeAtPoint}.
 */
export function drawHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): void {
  const text = linkBadgeText(link)
  if (!text) return

  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)

  function placeBadge(left: number, centreY: number): void {
    const top = centreY - BADGE_HEIGHT / 2
    badge.draw(ctx, left, top)
    hitAreas.push({
      linkId: link.id,
      x: left,
      y: top,
      width,
      height: BADGE_HEIGHT
    })
  }

  const [outputSocketX, outputSocketY] = startPos
  const outputBadgeX = outputSocketX + BADGE_GAP
  const outputBadgeY = freeBadgeCentreY(outputBadgeX, outputSocketY, width)
  drawConnectorStub(
    ctx,
    [outputSocketX, outputSocketY],
    [outputBadgeX + BADGE_CONNECT_INSET, outputBadgeY],
    color
  )
  placeBadge(outputBadgeX, outputBadgeY)

  const [inputSocketX, inputSocketY] = endPos
  const inputBadgeX = inputSocketX - BADGE_GAP - width
  const inputBadgeY = freeBadgeCentreY(inputBadgeX, inputSocketY, width)
  drawConnectorStub(
    ctx,
    [inputSocketX, inputSocketY],
    [inputBadgeX + width - BADGE_CONNECT_INSET, inputBadgeY],
    color
  )
  placeBadge(inputBadgeX, inputBadgeY)
}

/**
 * Queues a hidden link's badges to be drawn once all noodles are rendered, so
 * the labels stay on top. Drawn by {@link drawPendingLinkBadges}.
 */
export function enqueueHiddenLinkBadges(
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): void {
  pendingBadges.push({ link, startPos, endPos, color })
}

/** Draws every queued badge on top of the rendered links, then clears the queue. */
export function drawPendingLinkBadges(ctx: CanvasRenderingContext2D): void {
  for (const { link, startPos, endPos, color } of pendingBadges) {
    drawHiddenLinkBadges(ctx, link, startPos, endPos, color)
  }
  pendingBadges.length = 0
}
