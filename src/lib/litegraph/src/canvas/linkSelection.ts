import { partition, sortBy } from 'es-toolkit'

import { getLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import {
  pointInBounds,
  polylineIntersectsBounds
} from '@/renderer/core/layout/utils/layoutMath'
import type { Bounds, Point } from '@/renderer/core/layout/types'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { SlotDirection } from '@/types/slotId'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type {
  AnimationOptions,
  DragAndScale
} from '@/lib/litegraph/src/DragAndScale'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import type { LinkSegment, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { inputLinkId, outputLinkIds } from '@/lib/litegraph/src/node/slotLinks'
import { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { deleteLinks, hideLinks, showLinks } from './linkVisibility'
import type { LinkMutationHost } from './linkVisibility'

interface LinkSelectionHost extends LinkMutationHost {
  graph: LGraph | null
}

interface LinkJumpHost {
  graph: LGraph | null
  ds: Pick<DragAndScale, 'fitToBounds' | 'getViewportSize' | 'scale'>
  animateToBounds(bounds: ReadOnlyRect, options?: AnimationOptions): void
  setDirty(foreground: boolean, background?: boolean): void
}

interface PanOptions {
  viewport?: ReadOnlyRect
  reducedMotion: boolean
}

const ARRIVAL_TOOLBOX_CLEARANCE = 64

type LinkEndNode =
  | { readonly kind: 'node'; readonly node: LGraphNode }
  | { readonly kind: 'subgraphInputs'; readonly node: SubgraphInputNode }
  | { readonly kind: 'subgraphOutputs'; readonly node: SubgraphOutputNode }

/** A node at the far end of a socket's selected links, with the links that reach it. */
export type LinkDestination = LinkEndNode & {
  readonly nodeId: NodeId
  readonly links: readonly LLink[]
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

function slotLinkIds(
  graph: LGraph,
  nodeId: NodeId,
  direction: SlotDirection,
  slot: number
): LinkId[] {
  if (direction === 'output') return outputLinkIds(graph, nodeId, slot)
  const linkId = inputLinkId(graph, nodeId, slot)
  return linkId === undefined ? [] : [linkId]
}

function slotLinks(
  graph: LGraph,
  nodeId: NodeId,
  direction: SlotDirection,
  slot: number
): LLink[] {
  return slotLinkIds(graph, nodeId, direction, slot).flatMap((linkId) => {
    const link = graph.getLink(linkId)
    return link ? [link] : []
  })
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

function oppositeSlotDirection(direction: SlotDirection): SlotDirection {
  return direction === 'input' ? 'output' : 'input'
}

function farEnd(
  link: LLink,
  near: SlotDirection
): { nodeId: NodeId; slot: number } {
  return near === 'input'
    ? { nodeId: link.origin_id, slot: link.origin_slot }
    : { nodeId: link.target_id, slot: link.target_slot }
}

function linkEndNode(graph: LGraph, nodeId: NodeId): LinkEndNode | undefined {
  if (graph instanceof Subgraph) {
    if (nodeId === SUBGRAPH_INPUT_ID)
      return { kind: 'subgraphInputs', node: graph.inputNode }
    if (nodeId === SUBGRAPH_OUTPUT_ID)
      return { kind: 'subgraphOutputs', node: graph.outputNode }
  }
  const node = graph.getNodeById(nodeId)
  return node ? { kind: 'node', node } : undefined
}

function slotCount(end: LinkEndNode, direction: SlotDirection): number {
  switch (end.kind) {
    case 'subgraphInputs':
      return direction === 'output' ? end.node.slots.length : 0
    case 'subgraphOutputs':
      return direction === 'input' ? end.node.slots.length : 0
    case 'node':
      return direction === 'input'
        ? end.node.inputs.length
        : end.node.outputs.length
  }
}

function isSlotIndex(
  end: LinkEndNode,
  direction: SlotDirection,
  slot: number
): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < slotCount(end, direction)
}

function socketPosition(
  end: LinkEndNode,
  direction: SlotDirection,
  slot: number
): Point {
  const [x, y] =
    end.kind !== 'node'
      ? end.node.slots[slot].pos
      : direction === 'input'
        ? end.node.getInputPos(slot)
        : end.node.getOutputPos(slot)
  return { x, y }
}

/** The nodes at the far end of a socket's selected links, top to bottom; none for a marquee. */
export function getSelectedLinkDestinations(graph: LGraph): LinkDestination[] {
  const socketType = useLinkSelectionStore().selection?.socketType
  if (!socketType) return []
  const arrivalDirection = oppositeSlotDirection(socketType)
  const linksByNode = new Map<NodeId, LLink[]>()
  for (const link of getSelectedLinks(graph)) {
    const { nodeId } = farEnd(link, socketType)
    const reaching = linksByNode.get(nodeId)
    if (reaching) reaching.push(link)
    else linksByNode.set(nodeId, [link])
  }
  const destinations = [...linksByNode].flatMap(([nodeId, links]) => {
    const end = linkEndNode(graph, nodeId)
    if (!end) return []
    const arriving = links.filter((link) => {
      const { slot } = farEnd(link, socketType)
      return (
        isSlotIndex(end, arrivalDirection, slot) &&
        slotLinkIds(graph, nodeId, arrivalDirection, slot).includes(link.id)
      )
    })
    return arriving.length ? [{ ...end, nodeId, links: arriving }] : []
  })
  return sortBy(destinations, [
    (destination) => destination.node.pos[1],
    (destination) => destination.node.pos[0]
  ])
}

/** Frames the destination and selects the links of the socket it lands on, as a click on that socket would. */
export function goToLinkDestination(
  host: LinkJumpHost,
  nodeId: NodeId,
  options: PanOptions
): boolean {
  const { graph } = host
  const socketType = useLinkSelectionStore().selection?.socketType
  if (!graph || !socketType) return false
  const destination = getSelectedLinkDestinations(graph).find(
    (candidate) => candidate.nodeId === nodeId
  )
  if (!destination) return false
  const arrival = selectArrivalSocket(graph, socketType, destination)
  if (!arrival) return false
  const nodeBounds = destination.node.boundingRect
  panToBounds(
    host,
    fitsInView(host.ds, nodeBounds, options.viewport)
      ? nodeBounds
      : [arrival.x, arrival.y, 0, 0],
    options
  )
  return true
}

function selectArrivalSocket(
  graph: LGraph,
  departureDirection: SlotDirection,
  destination: LinkDestination
): Point | undefined {
  const arrivalDirection = oppositeSlotDirection(departureDirection)
  const arrivalSlot = destination.links.reduce(
    (lowest, link) => Math.min(lowest, farEnd(link, departureDirection).slot),
    Infinity
  )
  const links = slotLinks(
    graph,
    destination.nodeId,
    arrivalDirection,
    arrivalSlot
  )
  if (!links.length) return undefined
  const position = socketPosition(destination, arrivalDirection, arrivalSlot)
  selectSocketLinks(links, arrivalDirection, position)
  return position
}

function fitsInView(
  ds: LinkJumpHost['ds'],
  [, , width, height]: ReadOnlyRect,
  viewport: ReadOnlyRect | undefined
): boolean {
  const [viewWidth, viewHeight] = viewport
    ? [viewport[2], viewport[3]]
    : ds.getViewportSize()
  const clearance = 2 * ARRIVAL_TOOLBOX_CLEARANCE
  return (
    width * ds.scale <= viewWidth - clearance &&
    height * ds.scale <= viewHeight - clearance
  )
}

function panToBounds(
  host: LinkJumpHost,
  bounds: ReadOnlyRect,
  { viewport, reducedMotion }: PanOptions
): void {
  const framing = { zoom: 0, viewport }
  if (!reducedMotion) {
    host.animateToBounds(bounds, framing)
    return
  }
  host.ds.fitToBounds(bounds, framing)
  host.setDirty(true, true)
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
