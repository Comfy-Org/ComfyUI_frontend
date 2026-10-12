import { getLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { polylineIntersectsBounds } from '@/renderer/core/layout/utils/layoutMath'
import type { Bounds, Point } from '@/renderer/core/layout/types'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import type { LGraph } from '../LGraph'
import { LLink } from '../LLink'
import { Reroute } from '../Reroute'
import type { LinkSegment, ReadOnlyRect } from '../interfaces'
import { deleteLinks, hideLinks } from './linkVisibility'

interface LinkSelectionHost {
  graph: LGraph | null
  emitBeforeChange(): void
  emitAfterChange(): void
  setDirty(fgcanvas: boolean, bgcanvas?: boolean): void
}

function isDrawnInBounds(segment: object, bounds: Bounds): boolean {
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

function selectedSegments(graph: LGraph, selected: Set<LinkId>): object[] {
  const segments: object[] = [...selected].flatMap((linkId) => {
    const link = graph.getLink(linkId)
    return link ? [link] : []
  })
  for (const reroute of graph.reroutes.values()) {
    if ([...reroute.linkIds].some((linkId) => selected.has(linkId)))
      segments.push(reroute)
  }
  return segments
}

function polylineYsAtX(polyline: readonly Point[], x: number): number[] {
  return polyline.slice(1).flatMap((end, i) => {
    const start = polyline[i]
    const [left, right] = start.x <= end.x ? [start, end] : [end, start]
    if (x < left.x || x > right.x) return []
    if (right.x === left.x) return [Math.min(left.y, right.y)]
    const t = (x - left.x) / (right.x - left.x)
    return [left.y + (right.y - left.y) * t]
  })
}

/** Canvas point on the topmost selected link at the marquee's release x. */
export function getSelectedLinksAnchor(graph: LGraph): Point | null {
  const selection = useLinkSelectionStore().selection
  const selected = new Set(getSelectedLinkIds(graph))
  if (!selection || !selected.size) return null
  const polylines = selectedSegments(graph, selected).flatMap((segment) => {
    const polyline = getLinkPolyline(segment)
    return polyline ? [polyline] : []
  })
  const x = selection.anchorX
  const ys = polylines.flatMap((polyline) => polylineYsAtX(polyline, x))
  if (ys.length) return { x, y: Math.min(...ys) }
  const points = polylines.flat()
  if (!points.length) return null
  return { x, y: Math.min(...points.map((point) => point.y)) }
}

function selectLinksInBounds(
  graph: LGraph,
  renderedPaths: Iterable<LinkSegment>,
  bounds: Bounds,
  anchorX: number
): void {
  const scope = graphScopeOf(graph)
  const presentation = useLinkPresentationStore()
  const linkIds = [...linkIdsDrawnInBounds(renderedPaths, bounds)].filter(
    (linkId) =>
      graph.getLink(linkId) &&
      presentation.getPresentation(scope, linkId)?.hidden !== true
  )
  useLinkSelectionStore().select(scope, linkIds, anchorX)
}

/** Selects links under a marquee that captured nothing else; otherwise clears. */
export function selectLinksForMarquee(
  graph: LGraph | null,
  renderedPaths: Iterable<LinkSegment>,
  capturedItemCount: number,
  [x, y, width, height]: ReadOnlyRect,
  pointer: { shiftKey: boolean; altKey: boolean; canvasX: number }
): void {
  if (graph && !capturedItemCount && !pointer.shiftKey && !pointer.altKey)
    selectLinksInBounds(
      graph,
      renderedPaths,
      { x, y, width, height },
      pointer.canvasX
    )
  else clearLinkSelection()
}

/** Selected links that still exist in the graph. */
export function getSelectedLinkIds(graph: LGraph): LinkId[] {
  return useLinkSelectionStore()
    .linkIdsIn(graphScopeOf(graph))
    .filter((linkId) => graph.getLink(linkId))
}

export function clearLinkSelection(): void {
  useLinkSelectionStore().clear()
}

/** Hides every selected link as one undo step. */
export function hideSelectedLinks(host: LinkSelectionHost): boolean {
  const { graph } = host
  if (!graph) return false
  const linkIds = getSelectedLinkIds(graph)
  if (!linkIds.length) return false
  hideLinks(host, graphScopeOf(graph), linkIds)
  clearLinkSelection()
  return true
}

/** Deletes every selected link as one undo step. */
export function deleteSelectedLinks(host: LinkSelectionHost): boolean {
  const { graph } = host
  if (!graph) return false
  const linkIds = getSelectedLinkIds(graph)
  if (!linkIds.length) return false
  deleteLinks(host, graph, linkIds)
  clearLinkSelection()
  return true
}
