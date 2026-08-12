import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import type { LLink } from '../LLink'
import type { Reroute } from '../Reroute'
import { LinkRenderType } from '../types/globalEnums'
import { queryLinkBadgeAtPoint } from './linkBadges'

interface CanvasContextMenuTarget {
  reroute?: Reroute
  link?: LLink
  group?: LGraphGroup
}

/** Resolves the canvas items under a canvas-space point for a right-click. */
export function getCanvasContextMenuTarget(
  canvas: LGraphCanvas,
  x: number,
  y: number
): CanvasContextMenuTarget {
  const { graph } = canvas
  if (!graph) return {}

  let reroute: Reroute | undefined
  let link: LLink | undefined
  if (canvas.links_render_mode !== LinkRenderType.HIDDEN_LINK) {
    const layoutHit = layoutStore.queryRerouteAtPoint({ x, y })
    reroute = layoutHit
      ? graph.getReroute(layoutHit.id)
      : graph.getRerouteOnPos(
          x,
          y,
          (canvas as unknown as { _visibleReroutes: Iterable<Reroute> })
            ._visibleReroutes
        )

    if (!reroute) {
      const badgeLinkId = queryLinkBadgeAtPoint(
        canvas.linkBadgeFrameState,
        x,
        y
      )
      const badgeLink =
        badgeLinkId === undefined ? undefined : graph.getLink(badgeLinkId)
      if (badgeLink?.hidden) {
        link = badgeLink
      } else {
        const segmentHit = layoutStore.queryLinkSegmentAtPoint(
          { x, y },
          canvas.ctx
        )
        const segmentLink = segmentHit
          ? graph.getLink(segmentHit.linkId)
          : undefined
        if (segmentLink && !segmentLink.hidden) link = segmentLink
      }
    }
  }

  return { reroute, link, group: graph.getGroupOnPos(x, y) }
}
