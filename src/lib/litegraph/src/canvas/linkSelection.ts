import { getLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { polylineIntersectsBounds } from '@/renderer/core/layout/utils/layoutMath'
import type { Bounds } from '@/renderer/core/layout/types'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import type { LGraph } from '../LGraph'
import type { ReadOnlyRect } from '../interfaces'
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

function linkIdsDrawnInBounds(graph: LGraph, bounds: Bounds): Set<LinkId> {
  const linkIds = new Set<LinkId>()
  for (const link of graph.links.values()) {
    if (isDrawnInBounds(link, bounds)) linkIds.add(link.id)
  }
  for (const reroute of graph.reroutes.values()) {
    if (!isDrawnInBounds(reroute, bounds)) continue
    for (const linkId of reroute.linkIds) linkIds.add(linkId)
  }
  return linkIds
}

/** Canvas-space bounds of every drawn segment of the selected links. */
export function getSelectedLinkBounds(graph: LGraph): ReadOnlyRect[] {
  const selected = new Set(getSelectedLinkIds(graph))
  const segments: object[] = [...selected].flatMap((linkId) => {
    const link = graph.getLink(linkId)
    return link ? [link] : []
  })
  for (const reroute of graph.reroutes.values()) {
    if ([...reroute.linkIds].some((linkId) => selected.has(linkId)))
      segments.push(reroute)
  }
  return segments.flatMap((segment) => {
    const polyline = getLinkPolyline(segment)
    if (!polyline?.length) return []
    const xs = polyline.map((point) => point.x)
    const ys = polyline.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return [[x, y, Math.max(...xs) - x, Math.max(...ys) - y] as const]
  })
}

/** Selects the visible links drawn inside or across the bounds. */
export function selectLinksInBounds(graph: LGraph, bounds: Bounds): void {
  const scope = graphScopeOf(graph)
  const presentation = useLinkPresentationStore()
  const linkIds = [...linkIdsDrawnInBounds(graph, bounds)].filter(
    (linkId) =>
      graph.getLink(linkId) &&
      presentation.getPresentation(scope, linkId)?.hidden !== true
  )
  useLinkSelectionStore().select(scope, linkIds)
}

/** Selects links under a marquee that captured nothing else; otherwise clears. */
export function selectLinksForMarquee(
  graph: LGraph | null,
  capturedItemCount: number,
  [x, y, width, height]: ReadOnlyRect,
  modifiers: { shiftKey: boolean; altKey: boolean }
): void {
  if (graph && !capturedItemCount && !modifiers.shiftKey && !modifiers.altKey)
    selectLinksInBounds(graph, { x, y, width, height })
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
