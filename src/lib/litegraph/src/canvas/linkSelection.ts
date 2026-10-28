import { partition, sortBy } from 'es-toolkit'

import { getLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import {
  pointInBounds,
  polylineIntersectsBounds
} from '@/renderer/core/layout/utils/layoutMath'
import type {
  Bounds,
  Point2D as Point,
  ReadOnlyRect
} from '@comfyorg/shared-frontend-utils/geometry'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { SlotDirection } from '@comfyorg/graph-model/slotId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import type { LinkSegment } from '@comfyorg/graph-model/interfaces'
import { inputLink, outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { LinkRenderType } from '@comfyorg/graph-model/globalEnums'
import { getLinkEnd } from './linkGeometry'
import type { LinkEnd } from './linkGeometry'
import { deleteLinks, hideLinks, showLinks } from './linkVisibility'
import type { LinkMutationHost } from './linkVisibility'

interface LinkSelectionHost extends LinkMutationHost {
  graph: LGraph | null
}

export interface LinkArrival {
  readonly socket: Point
  readonly bounds: ReadOnlyRect
}

interface MarqueeHost {
  graph: LGraph | null
  renderedPaths: Iterable<LinkSegment>
}

function isDrawnInBounds(segment: LinkSegment, bounds: Bounds): boolean {
  const polyline = getLinkPolyline(segment)
  return !!polyline && polylineIntersectsBounds(polyline, bounds)
}

function linkIdsDrawnInBounds(
  renderedPaths: Iterable<LinkSegment>,
  bounds: Bounds
): Set<LinkId> {
  const linkIds = new Set<LinkId>()
  for (const segment of renderedPaths) {
    if (!isDrawnInBounds(segment, bounds)) continue
    if (segment instanceof Reroute) {
      for (const linkId of segment.linkIds) linkIds.add(linkId)
    } else if (segment instanceof LLink) {
      linkIds.add(segment.id)
    }
  }
  return linkIds
}

function isLinkVisible(graph: LGraph, link: LLink): boolean {
  return (
    useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
      ?.hidden !== true
  )
}

function getSelectedLinks(graph: LGraph): LLink[] {
  const selection = useLinkSelectionStore().selection
  if (!selection) return []
  return selection.links.filter(
    (link) =>
      graph.getLink(link.id) === link &&
      (selection.socketType !== undefined || isLinkVisible(graph, link))
  )
}

/** Ids of the selected links that are still the graph's own links. */
export function getSelectedLinkIds(graph: LGraph): LinkId[] {
  return getSelectedLinks(graph).map((link) => link.id)
}

function partitionSelectedLinksByVisibility(
  graph: LGraph
): [visible: LLink[], hidden: LLink[]] {
  return partition(getSelectedLinks(graph), (link) =>
    isLinkVisible(graph, link)
  )
}

function segmentsOf(graph: LGraph, links: readonly LLink[]): LinkSegment[] {
  const linkIds = new Set(links.map((link) => link.id))
  const reroutes = [...graph.reroutes.values()].filter((reroute) =>
    [...reroute.linkIds].some((linkId) => linkIds.has(linkId))
  )
  return [...links, ...reroutes]
}

function topmostCrossingAtX(
  polyline: readonly Point[],
  x: number,
  marquee: Bounds
): number {
  let top = Infinity
  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1]
    const b = polyline[i]
    const [left, right] = a.x <= b.x ? [a, b] : [b, a]
    if (x < left.x || x > right.x) continue
    const y =
      right.x === left.x
        ? Math.min(left.y, right.y)
        : left.y + ((right.y - left.y) * (x - left.x)) / (right.x - left.x)
    if (y >= marquee.y && y <= marquee.y + marquee.height)
      top = Math.min(top, y)
  }
  return top
}

function topmostPointInside(
  polyline: readonly Point[],
  marquee: Bounds
): number {
  let top = Infinity
  for (const point of polyline) {
    if (pointInBounds(point, marquee)) top = Math.min(top, point.y)
  }
  return top
}

export function getSelectedLinksAnchor(graph: LGraph): Point | undefined {
  const selection = useLinkSelectionStore().selection
  const links = getSelectedLinks(graph)
  if (!selection || !links.length) return undefined
  const visibleLinks = links.filter((link) => isLinkVisible(graph, link))
  const { anchorX: x, marquee } = selection
  const polylines = segmentsOf(graph, visibleLinks).flatMap((segment) => {
    const polyline = getLinkPolyline(segment)
    return polyline ? [polyline] : []
  })
  let crossing = Infinity
  let inside = Infinity
  for (const polyline of polylines) {
    crossing = Math.min(crossing, topmostCrossingAtX(polyline, x, marquee))
    inside = Math.min(inside, topmostPointInside(polyline, marquee))
  }
  if (crossing !== Infinity) return { x, y: crossing }
  if (inside !== Infinity) return { x, y: inside }
  return { x, y: marquee.y }
}

function slotLinks(
  graph: LGraph,
  nodeId: NodeId,
  direction: SlotDirection,
  slot: number
): LLink[] {
  if (direction === 'output') return outputLinks(graph, nodeId, slot)
  const link = inputLink(graph, nodeId, slot)
  return link ? [link] : []
}

export function hasModifierKey(
  event: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey || event.altKey
}

export function selectSlotLinks(
  host: {
    graph: LGraph | null
    links_render_mode: number
    deselectAll(): void
  },
  node: LGraphNode,
  type: 'input' | 'output',
  slot: number,
  slotPosition: Point
): boolean {
  const { graph } = host
  if (!graph || node.graph !== graph) return false
  if (host.links_render_mode === LinkRenderType.HIDDEN_LINK) return false
  const links = slotLinks(graph, node.id, type, slot)
  if (!links.length) return false
  host.deselectAll()
  selectSocketLinks(links, type, slotPosition)
  return true
}

function selectSocketLinks(
  links: readonly LLink[],
  socketType: SlotDirection,
  position: Point
): void {
  useLinkSelectionStore().select({
    links,
    marquee: { ...position, width: 0, height: 0 },
    anchorX: position.x,
    socketType
  })
}

function selectedArrivalDirection(): SlotDirection | undefined {
  const departure = useLinkSelectionStore().selection?.socketType
  if (!departure) return undefined
  return departure === 'input' ? 'output' : 'input'
}

function destinationsByNode(
  graph: LGraph,
  arrival: SlotDirection
): Map<NodeId, LinkEnd> {
  const destinations = new Map<NodeId, LinkEnd>()
  for (const link of getSelectedLinks(graph)) {
    const end = getLinkEnd(graph, link, arrival)
    if (!end) continue
    const reached = destinations.get(end.node.id)
    if (!reached || end.slot < reached.slot) destinations.set(end.node.id, end)
  }
  return destinations
}

/** The nodes at the far end of a socket's selected links, top to bottom, each at the lowest socket reached; none for a marquee. */
export function getSelectedLinkDestinations(graph: LGraph): LinkEnd[] {
  const arrival = selectedArrivalDirection()
  if (!arrival) return []
  return sortBy(
    [...destinationsByNode(graph, arrival).values()],
    [
      (destination) => destination.node.pos[1],
      (destination) => destination.node.pos[0]
    ]
  )
}

export function selectLinkDestination(
  graph: LGraph,
  nodeId: NodeId
): LinkArrival | undefined {
  const arrival = selectedArrivalDirection()
  if (!arrival) return undefined
  const destination = destinationsByNode(graph, arrival).get(nodeId)
  if (!destination) return undefined
  const [x, y] = destination.position
  const socket = { x, y }
  selectSocketLinks(
    slotLinks(graph, nodeId, arrival, destination.slot),
    arrival,
    socket
  )
  return { socket, bounds: destination.node.boundingRect }
}

export function selectLinksInMarquee(
  { graph, renderedPaths }: MarqueeHost,
  [x, y, width, height]: ReadOnlyRect,
  anchorX: number
): void {
  if (!graph) {
    clearLinkSelection()
    return
  }
  const marquee = { x, y, width, height }
  const links = [...linkIdsDrawnInBounds(renderedPaths, marquee)].flatMap(
    (linkId) => {
      const link = graph.getLink(linkId)
      return link && isLinkVisible(graph, link) ? [link] : []
    }
  )
  useLinkSelectionStore().select({ links, marquee, anchorX })
}

export function clearLinkSelection(
  host?: Pick<LinkSelectionHost, 'setDirty'>
): boolean {
  const cleared = useLinkSelectionStore().clear()
  if (cleared) host?.setDirty(true, true)
  return cleared
}

export function hideSelectedLinks(host: LinkSelectionHost): boolean {
  const { graph } = host
  if (!graph) return false
  const [visible] = partitionSelectedLinksByVisibility(graph)
  if (!visible.length) return false
  hideLinks(
    host,
    graphScopeOf(graph),
    visible.map((link) => link.id)
  )
  clearLinkSelection()
  return true
}

export function areSelectedLinksHidden(graph: LGraph): boolean {
  const [visible, hidden] = partitionSelectedLinksByVisibility(graph)
  return hidden.length > 0 && !visible.length
}

export function showSelectedLinks(host: LinkSelectionHost): boolean {
  const { graph } = host
  if (!graph) return false
  const [, hidden] = partitionSelectedLinksByVisibility(graph)
  if (!hidden.length) return false
  showLinks(
    host,
    graphScopeOf(graph),
    hidden.map((link) => link.id)
  )
  clearLinkSelection()
  return true
}

export function deleteSelectedLinks(host: LinkSelectionHost): boolean {
  const { graph } = host
  if (!graph) return false
  const links = getSelectedLinks(graph)
  if (!links.length) return false
  deleteLinks(host, graph, links)
  clearLinkSelection()
  return true
}
