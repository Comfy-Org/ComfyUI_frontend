import type { LGraphCanvas } from '../LGraphCanvas'
import type { LGraphGroup } from '../LGraphGroup'
import { LLink } from '../LLink'
import { Reroute } from '../Reroute'
import type { LinkSegment } from '../interfaces'
import { LinkRenderType } from '../types/globalEnums'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'

import {
  findRerouteAtPoint,
  queryRenderedLinkSegmentsAtPoint
} from './hitTesting'
import { queryHiddenLinkBadgeAtPoint } from './linkBadgeRenderer'

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
  const group = graph.getGroupOnPos(x, y)
  if (canvas.links_render_mode === LinkRenderType.HIDDEN_LINK) return { group }

  const reroute = findRerouteAtPoint(
    graph,
    x,
    y,
    canvas._visibleReroutes,
    canvas.renderedPaths
  )
  if (reroute) return { reroute, group }

  const badgeLink = queryHiddenLinkBadgeAtPoint(canvas, graph, x, y)
  if (badgeLink) return { link: badgeLink, group }

  const hit = queryVisibleLinkAtPoint(canvas, x, y)
  if (hit) return { linkSegment: hit.segment, link: hit.link, group }

  return { group }
}
