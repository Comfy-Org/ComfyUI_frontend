import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import type { LGraphNode } from '../LGraphNode'
import { LiteGraph } from '../litegraph'
import { Reroute } from '../Reroute'
import type { LinkSegment, Point, Positionable } from '../interfaces'
import { isInRectangle } from '../measure'
import type { SubgraphInputNode } from '../subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '../subgraph/SubgraphOutputNode'
import { LinkMarkerShape, LinkRenderType } from '../types/globalEnums'
import type { CanvasPointerEvent } from '../types/events'

/** What a primary-button press landed on, resolved once per press. */
export type PointerTarget =
  | { kind: 'node'; node: LGraphNode }
  | { kind: 'subgraphIO'; ioNode: SubgraphInputNode | SubgraphOutputNode }
  | { kind: 'reroute'; reroute: Reroute; part: 'body' | 'input' | 'output' }
  | { kind: 'link'; segment: LinkSegment }
  | { kind: 'linkCentre'; segment: LinkSegment }
  | { kind: 'groupResize'; group: LGraphGroup }
  | { kind: 'groupTitle'; group: LGraphGroup }
  | { kind: 'group'; group: LGraphGroup }
  | { kind: 'empty' }

/**
 * Hit-tests a primary-button press in the order the canvas has always used:
 * node, subgraph IO node, reroute, link path with a drag modifier, link
 * centre marker, group resize handle, group title, group body, empty.
 */
export function resolvePointerTarget(
  canvas: LGraphCanvas,
  e: CanvasPointerEvent,
  node: LGraphNode | undefined
): PointerTarget {
  const { graph, subgraph } = canvas
  if (!graph) return { kind: 'empty' }

  if (node && (canvas.allow_interaction || node.flags.allow_interaction))
    return { kind: 'node', node }

  const point: Point = [e.canvasX, e.canvasY]

  const ioNode = subgraph?.getIoNodeOnPos(point[0], point[1])
  if (ioNode) return { kind: 'subgraphIO', ioNode }

  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    const reroute = findReroute(canvas, point)
    if (reroute) return reroute

    const link = findLinkSegment(canvas, e, point)
    if (link) return link
  }

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

  const rerouteLayout = layoutStore.queryRerouteAtPoint(graph.rootGraph.id, {
    x: point[0],
    y: point[1]
  })
  const fromLayout = rerouteLayout && graph.getReroute(rerouteLayout.id)

  for (const reroute of canvas._visibleReroutes) {
    const over = fromLayout === reroute || reroute.containsPoint(point)
    if (over) return { kind: 'reroute', reroute, part: 'body' }
    if (reroute.isOutputHovered)
      return { kind: 'reroute', reroute, part: 'output' }
    if (reroute.isInputHovered)
      return { kind: 'reroute', reroute, part: 'input' }
  }
}

function findLinkSegment(
  canvas: LGraphCanvas,
  e: CanvasPointerEvent,
  point: Point
): PointerTarget | undefined {
  const { ctx } = canvas
  const { lineWidth } = ctx
  ctx.lineWidth = canvas.connections_width + 7
  try {
    return findLinkSegmentWithStroke(canvas, e, point)
  } finally {
    ctx.lineWidth = lineWidth
  }
}

function findLinkSegmentWithStroke(
  canvas: LGraphCanvas,
  e: CanvasPointerEvent,
  [x, y]: Point
): PointerTarget | undefined {
  const { ctx } = canvas
  const dpi = Math.max(window.devicePixelRatio, 1)
  const hitSegment = layoutStore.queryLinkSegmentAtPoint({ x, y }, ctx)
  const anyModifier = e.shiftKey || e.altKey
  const oneModifier = e.shiftKey !== e.altKey
  const showsCentre = canvas.linkMarkerShape !== LinkMarkerShape.None

  function isOnPath(segment: LinkSegment): boolean {
    const hitId =
      segment instanceof Reroute ? hitSegment?.rerouteId : hitSegment?.linkId
    if (hitSegment && segment.id === hitId) return true
    return !!segment.path && ctx.isPointInStroke(segment.path, x * dpi, y * dpi)
  }

  for (const segment of canvas.renderedPaths) {
    const centre = segment._pos

    if (anyModifier && isOnPath(segment)) {
      if (oneModifier) return { kind: 'link', segment }
      continue
    }

    if (showsCentre && isInRectangle(x, y, centre[0] - 4, centre[1] - 4, 8, 8))
      return { kind: 'linkCentre', segment }
  }
}

/** The item a click on {@link target} selects, if any. */
export function selectableOf(target: PointerTarget): Positionable | undefined {
  switch (target.kind) {
    case 'node':
      return target.node
    case 'subgraphIO':
      return target.ioNode
    case 'reroute':
      return target.part === 'body' ? target.reroute : undefined
    case 'groupTitle':
      return target.group
    default:
      return undefined
  }
}
