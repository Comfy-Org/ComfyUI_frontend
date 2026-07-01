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
 * handlers. Module-level so the canvas god-object gains no new render state; safe
 * because only the app canvas draws badges (offscreen/minimap canvases don't).
 */
const hitAreas: BadgeHitArea[] = []

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

/**
 * Laid-out badges from the current link pass, painted after the noodles so the
 * labels sit on top. Layout (positions + hit areas) happens at enqueue so a
 * revealed link's noodle can attach to the badge tip; only painting is deferred.
 */
const pendingBadges: BadgeLayout[] = []

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

function recordHitArea(
  linkId: LinkId,
  left: number,
  centreY: number,
  width: number
): void {
  hitAreas.push({
    linkId,
    x: left,
    y: centreY - BADGE_HEIGHT / 2,
    width,
    height: BADGE_HEIGHT
  })
}

/**
 * Lays out a hidden link's two end badges — one just past the output socket, one
 * just before the input socket — recording their hit areas. Returns the geometry
 * to paint later, or `undefined` if the link has no badge text.
 */
function layoutHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): BadgeLayout | undefined {
  const text = linkBadgeText(link)
  if (!text) return undefined

  const badge = makeBadge(text, color)
  const width = badge.getWidth(ctx)

  const [outputSocketX, outputSocketY] = startPos
  const outputBadgeX = outputSocketX + BADGE_GAP
  const outputBadgeY = freeBadgeCentreY(outputBadgeX, outputSocketY, width)
  recordHitArea(link.id, outputBadgeX, outputBadgeY, width)

  const [inputSocketX, inputSocketY] = endPos
  const inputBadgeX = inputSocketX - BADGE_GAP - width
  const inputBadgeY = freeBadgeCentreY(inputBadgeX, inputSocketY, width)
  recordHitArea(link.id, inputBadgeX, inputBadgeY, width)

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

/** Paints a laid-out badge pair: each socket's connector stub and its badge. */
function drawBadgeLayout(ctx: CanvasRenderingContext2D, l: BadgeLayout): void {
  drawConnectorStub(
    ctx,
    l.outputSocket,
    [l.outputBadgeX + BADGE_CONNECT_INSET, l.outputBadgeY],
    l.color
  )
  l.badge.draw(ctx, l.outputBadgeX, l.outputBadgeY - BADGE_HEIGHT / 2)

  drawConnectorStub(
    ctx,
    l.inputSocket,
    [l.inputBadgeX + l.width - BADGE_CONNECT_INSET, l.inputBadgeY],
    l.color
  )
  l.badge.draw(ctx, l.inputBadgeX, l.inputBadgeY - BADGE_HEIGHT / 2)
}

/** The far edge of each badge, where a revealed link's noodle attaches. */
function badgeTips(l: BadgeLayout): { outputTip: Point; inputTip: Point } {
  return {
    outputTip: [l.outputBadgeX + l.width, l.outputBadgeY],
    inputTip: [l.inputBadgeX, l.inputBadgeY]
  }
}

/** Lays out and immediately paints a hidden link's end badges. */
export function drawHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): void {
  const layout = layoutHiddenLinkBadges(ctx, link, startPos, endPos, color)
  if (layout) drawBadgeLayout(ctx, layout)
}

/**
 * Lays out a hidden link's badges now — so its hit areas and tip positions are
 * known — but defers painting to {@link drawPendingLinkBadges}, keeping labels
 * above the noodles. Returns the badge tips a revealed link's noodle attaches to.
 */
export function enqueueHiddenLinkBadges(
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  color: string
): { outputTip: Point; inputTip: Point } | undefined {
  const layout = layoutHiddenLinkBadges(ctx, link, startPos, endPos, color)
  if (!layout) return undefined
  pendingBadges.push(layout)
  return badgeTips(layout)
}

/** Paints every queued badge on top of the rendered links, then clears the queue. */
export function drawPendingLinkBadges(ctx: CanvasRenderingContext2D): void {
  for (const layout of pendingBadges) drawBadgeLayout(ctx, layout)
  pendingBadges.length = 0
}
