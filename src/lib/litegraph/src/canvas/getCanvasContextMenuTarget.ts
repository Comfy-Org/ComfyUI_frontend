import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import { LLink } from '../LLink'
import { Reroute } from '../Reroute'
import { LinkRenderType } from '../types/globalEnums'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { findRerouteAtPoint } from './findRerouteAtPoint'
import { queryLinkBadgeAtPoint } from './linkBadges'

interface CanvasContextMenuTarget {
  reroute?: Reroute
  link?: LLink
  group?: LGraphGroup
}

function queryVisibleLinkAtPoint(
  canvas: LGraphCanvas,
  x: number,
  y: number
): LLink | undefined {
  const { ctx, graph, renderedPaths } = canvas
  if (!graph) return
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const isHidden = (link: LLink) =>
    presentationStore.getPresentation(scope, link.id)?.hidden === true

  const lineWidth = ctx.lineWidth
  ctx.lineWidth = canvas.connections_width + 7
  try {
    const segmentHit = layoutStore.queryLinkSegmentAtPoint({ x, y }, ctx)
    const layoutLink = segmentHit ? graph.getLink(segmentHit.linkId) : undefined
    if (layoutLink && !isHidden(layoutLink) && renderedPaths.has(layoutLink)) {
      return layoutLink
    }

    const dpi = Math.max(window.devicePixelRatio, 1)
    for (const segment of renderedPaths) {
      if (
        !segment.path ||
        !ctx.isPointInStroke(segment.path, x * dpi, y * dpi)
      ) {
        continue
      }
      if (segment instanceof LLink) {
        if (!isHidden(segment)) return segment
        continue
      }
      if (segment instanceof Reroute) {
        for (const linkId of segment.linkIds) {
          const link = graph.getLink(linkId)
          if (link && !isHidden(link)) return link
        }
      }
    }
  } finally {
    ctx.lineWidth = lineWidth
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
        link = queryVisibleLinkAtPoint(canvas, x, y)
      }
    }
  }

  return { reroute, link, group: graph.getGroupOnPos(x, y) }
}
