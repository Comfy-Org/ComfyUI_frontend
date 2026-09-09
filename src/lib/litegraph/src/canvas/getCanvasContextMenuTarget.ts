import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import { LLink } from '../LLink'
import { Reroute } from '../Reroute'
import type { LinkSegment } from '../interfaces'
import { LinkRenderType } from '../types/globalEnums'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { findRerouteAtPoint } from './findRerouteAtPoint'
import { queryLinkBadgeAtPoint } from './linkBadges'
import { queryRenderedLinkSegmentsAtPoint } from './queryRenderedLinkSegmentsAtPoint'

interface CanvasContextMenuTarget {
  reroute?: Reroute
  linkSegment?: LinkSegment
  link?: LLink
  group?: LGraphGroup
}

function queryVisibleLinkAtPoint(
  canvas: LGraphCanvas,
  x: number,
  y: number
): { segment: LinkSegment; link?: LLink } | undefined {
  const { graph } = canvas
  if (!graph) return
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const isHidden = (link: LLink) =>
    presentationStore.getPresentation(scope, link.id)?.hidden === true

  for (const segment of queryRenderedLinkSegmentsAtPoint(canvas, x, y)) {
    if (segment instanceof LLink) {
      if (!isHidden(segment)) return { segment, link: segment }
      continue
    }
    if (segment instanceof Reroute) {
      for (const linkId of segment.linkIds) {
        const link = graph.getLink(linkId)
        if (link && !isHidden(link)) return { segment, link }
      }
    }
  }
}

/** Resolves the canvas items under a canvas-space point for a right-click. */
export function getCanvasContextMenuTarget(
  canvas: LGraphCanvas,
  x: number,
  y: number
): CanvasContextMenuTarget {
  const { graph } = canvas
  if (!graph) return {}
  const scope = graphScopeOf(graph)

  let reroute: Reroute | undefined
  let linkSegment: LinkSegment | undefined
  let link: LLink | undefined
  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    reroute = findRerouteAtPoint(
      graph,
      x,
      y,
      canvas._visibleReroutes,
      canvas.renderedPaths
    )

    if (!reroute) {
      const badgeLinkId = queryLinkBadgeAtPoint(canvas, x, y)
      const badgeLink =
        badgeLinkId === undefined ? undefined : graph.getLink(badgeLinkId)
      if (
        badgeLink &&
        useLinkPresentationStore().getPresentation(scope, badgeLink.id)?.hidden
      ) {
        link = badgeLink
      } else {
        const hit = queryVisibleLinkAtPoint(canvas, x, y)
        linkSegment = hit?.segment
        link = hit?.link
      }
    }
  }

  return { reroute, linkSegment, link, group: graph.getGroupOnPos(x, y) }
}
