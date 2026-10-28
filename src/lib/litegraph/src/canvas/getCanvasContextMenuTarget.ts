import type {
  LGraphCanvas,
  LGraphGroup
} from '@/lib/litegraph/src/types/entityRegistry'

import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import type { LinkSegment } from '@/lib/litegraph/src/interfaces'
import { isInRectangle } from '@/lib/litegraph/src/measure'
import {
  LinkMarkerShape,
  LinkRenderType
} from '@/lib/litegraph/src/types/globalEnums'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { findRerouteAtPoint } from './hitTesting'
import {
  queryHiddenLinkBadgeAtPoint,
  queryHiddenLinkStackAtPoint
} from './linkBadgeRenderer'
import { getVisibleRerouteLink } from './linkVisibility'

interface CanvasContextMenuTarget {
  reroute?: Reroute
  linkSegment?: LinkSegment
  link?: LLink
  stackedLinks?: LLink[]
  group?: LGraphGroup
}

function queryVisibleLinkCentreAtPoint(
  canvas: LGraphCanvas,
  x: number,
  y: number
): { segment: LinkSegment; link?: LLink } | undefined {
  const { graph } = canvas
  if (!graph || canvas.linkMarkerShape === LinkMarkerShape.None) return
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const isHidden = (link: LLink) =>
    presentationStore.getPresentation(scope, link.id)?.hidden === true

  for (const segment of canvas.renderedPaths) {
    const [cx, cy] = segment._pos
    if (!isInRectangle(x, y, cx - 4, cy - 4, 8, 8)) continue
    if (segment instanceof LLink) {
      if (!isHidden(segment)) return { segment, link: segment }
      continue
    }
    if (segment instanceof Reroute) {
      const link = getVisibleRerouteLink(graph, segment)
      if (link) return { segment, link }
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

  const stack = queryHiddenLinkStackAtPoint(canvas, graph, x, y)
  if (stack) return { stackedLinks: stack.links, group }

  const badgeLink = queryHiddenLinkBadgeAtPoint(canvas, graph, x, y)
  if (badgeLink) return { link: badgeLink, group }

  const hit = queryVisibleLinkCentreAtPoint(canvas, x, y)
  if (hit) return { linkSegment: hit.segment, link: hit.link, group }

  return { group }
}
