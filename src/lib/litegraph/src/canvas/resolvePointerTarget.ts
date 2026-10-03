import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import type { LGraphNode } from '../LGraphNode'
import type { LLink } from '../LLink'
import { LiteGraph } from '../litegraph'
import type { Reroute } from '../Reroute'
import type { LinkSegment, Point, Positionable } from '../interfaces'
import { isInRectangle } from '../measure'
import type { SubgraphInputNode } from '../subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '../subgraph/SubgraphOutputNode'
import { LinkMarkerShape, LinkRenderType } from '../types/globalEnums'
import type { CanvasPointerEvent } from '../types/events'
import {
  findRerouteAtPoint,
  queryRenderedLinkSegmentsAtPoint
} from './hitTesting'
import { queryHiddenLinkBadgeAtPoint } from './linkBadgeRenderer'

/** What a primary-button press landed on, resolved once per press. */
export type PointerTarget =
  | { kind: 'node'; node: LGraphNode }
  | { kind: 'linkBadge'; link: LLink }
  | { kind: 'subgraphIO'; ioNode: SubgraphInputNode | SubgraphOutputNode }
  | { kind: 'reroute'; reroute: Reroute; part: 'body' | 'input' | 'output' }
  | { kind: 'link'; segment: LinkSegment }
  | { kind: 'linkCentre'; segment: LinkSegment }
  | { kind: 'groupResize'; group: LGraphGroup }
  | { kind: 'groupTitle'; group: LGraphGroup }
  | { kind: 'group'; group: LGraphGroup }
  | { kind: 'empty' }

/**
 * Hit-tests a primary-button press in interaction priority order:
 * node, hidden-link badge, subgraph IO node, reroute, link path with a drag
 * modifier, link centre marker, group resize handle, group title, group body,
 * empty.
 */
export function resolvePointerTarget(
  canvas: LGraphCanvas,
  e: CanvasPointerEvent,
  node: LGraphNode | undefined
): PointerTarget {
  const { graph, subgraph } = canvas
  if (!graph) return { kind: 'empty' }

  if (node) return { kind: 'node', node }

  const point: Point = [e.canvasX, e.canvasY]

  const badgeLink = queryHiddenLinkBadgeAtPoint(
    canvas,
    graph,
    point[0],
    point[1]
  )
  if (badgeLink) return { kind: 'linkBadge', link: badgeLink }

  const ioNode = subgraph?.getIoNodeOnPos(point[0], point[1])
  if (ioNode) return { kind: 'subgraphIO', ioNode }

  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    const reroute = findReroute(canvas, point)
    if (reroute) return reroute
  }

  const link = findLinkSegment(canvas, e, point)
  if (link) return link

  const group = graph.getGroupOnPos(point[0], point[1])
  if (!group) return { kind: 'empty' }
  if (group.isInResize(point[0], point[1]))
    return { kind: 'groupResize', group }
  const [x, y] = group.pos
  const inTitle = isInRectangle(
    point[0],
    point[1],
    x,
    y,
    group.size[0],
    LiteGraph.NODE_TITLE_HEIGHT
  )
  return { kind: inTitle ? 'groupTitle' : 'group', group }
}

function findReroute(
  canvas: LGraphCanvas,
  point: Point
): PointerTarget | undefined {
  const { graph } = canvas
  if (!graph) return

  const body = findRerouteAtPoint(
    graph,
    point[0],
    point[1],
    canvas._visibleReroutes,
    canvas.renderedPaths
  )
  if (body) return { kind: 'reroute', reroute: body, part: 'body' }

  for (const reroute of canvas._visibleReroutes) {
    if (reroute.isOutputHovered)
      return { kind: 'reroute', reroute, part: 'output' }
    if (reroute.isInputHovered)
      return { kind: 'reroute', reroute, part: 'input' }
  }
}

function findLinkSegment(
  canvas: LGraphCanvas,
  e: CanvasPointerEvent,
  [x, y]: Point
): PointerTarget | undefined {
  const hits = queryRenderedLinkSegmentsAtPoint(canvas, x, y)
  const anyModifier = e.shiftKey || e.altKey
  const oneModifier = e.shiftKey !== e.altKey
  const showsCentre = canvas.linkMarkerShape !== LinkMarkerShape.None

  for (const segment of canvas.renderedPaths) {
    const centre = segment._pos

    if (anyModifier && hits.has(segment)) {
      if (oneModifier) return { kind: 'link', segment }
      continue
    }

    if (showsCentre && isInRectangle(x, y, centre[0] - 4, centre[1] - 4, 8, 8))
      return { kind: 'linkCentre', segment }
  }
}

/** Resolves only targets eligible for ctrl/meta click selection, in legacy priority order. */
export function resolveSelectableTarget(
  canvas: LGraphCanvas,
  x: number,
  y: number
): Positionable | undefined {
  const ioNode = canvas.subgraph?.getIoNodeOnPos(x, y)
  if (ioNode) return ioNode

  const { graph } = canvas
  if (!graph) return
  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    const reroute = findRerouteAtPoint(
      graph,
      x,
      y,
      canvas._visibleReroutes,
      canvas.renderedPaths
    )
    if (reroute) return reroute
  }

  return graph.getGroupTitlebarOnPos(x, y)
}
