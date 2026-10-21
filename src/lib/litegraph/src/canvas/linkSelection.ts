import { partition } from 'es-toolkit'

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

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import type { LinkSegment, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { inputLinkId, outputLinkIds } from '@/lib/litegraph/src/node/slotLinks'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { deleteLinks, hideLinks, showLinks } from './linkVisibility'
import type { LinkMutationHost } from './linkVisibility'

interface LinkSelectionHost extends LinkMutationHost {
  graph: LGraph | null
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
      (selection.includesHidden || isLinkVisible(graph, link))
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
  node: LGraphNode,
  type: 'input' | 'output',
  slot: number
): LinkId[] {
  if (type === 'output') return outputLinkIds(graph, node.id, slot)
  const linkId = inputLinkId(graph, node.id, slot)
  return linkId === undefined ? [] : [linkId]
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
  const links = slotLinkIds(graph, node, type, slot).flatMap((linkId) => {
    const link = graph.getLink(linkId)
    return link ? [link] : []
  })
  if (!links.length) return false
  host.deselectAll()
  useLinkSelectionStore().select({
    links,
    marquee: { ...slotPosition, width: 0, height: 0 },
    anchorX: slotPosition.x,
    includesHidden: true
  })
  return true
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
