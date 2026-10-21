import type { LGraph, LLink } from '@/lib/litegraph/src/types/entityRegistry'

import type { HiddenLinkBadge } from './linkBadges'
import { graphScopeOf } from '@/types/graphScopeId'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import {
  layoutHiddenLinkBadges,
  queryLinkBadgeAtPoint,
  queryLinkBadgeHitAtPoint
} from './linkBadges'
import { getLinkEndpointPositions } from './linkGeometry'
import { slotTypeKey } from '@/lib/litegraph/src/utils/type'

export function queryHiddenLinkBadgeAtPoint(
  host: object,
  graph: LGraph,
  x: number,
  y: number
): LLink | undefined {
  const linkId = queryLinkBadgeAtPoint(host, x, y)
  if (linkId === undefined) return
  const link = graph.getLink(linkId)
  if (
    link &&
    useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
      ?.hidden
  ) {
    return link
  }
}

/** The stack of hidden links whose pill is under a canvas point. */
export function queryHiddenLinkStackAtPoint(
  host: object,
  graph: LGraph,
  x: number,
  y: number
): { stackKey: string; links: LLink[] } | undefined {
  const hit = queryLinkBadgeHitAtPoint(host, x, y)
  if (!hit?.stackKey) return
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const links = hit.linkIds
    .map((linkId) => graph.getLink(linkId))
    .filter(
      (link): link is LLink =>
        !!link && !!presentationStore.getPresentation(scope, link.id)?.hidden
    )
  if (links.length) return { stackKey: hit.stackKey, links }
}

export function layoutGraphLinkBadges(
  host: object,
  ctx: CanvasRenderingContext2D,
  graph: LGraph,
  linkTypeColors: Readonly<Record<string | number, string>>,
  defaultLinkColor: string
): ReturnType<typeof layoutHiddenLinkBadges> {
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const hiddenLinks: HiddenLinkBadge[] = []
  for (const linkId of presentationStore.graphHiddenLinkIds(scope)) {
    const link = graph.getLink(linkId)
    if (!link) continue
    const endpoints = getLinkEndpointPositions(graph, link)
    const presentation = presentationStore.getPresentation(scope, link.id)
    if (!endpoints || !presentation) continue

    hiddenLinks.push({
      link,
      presentation,
      startPos: endpoints[0],
      endPos: endpoints[1],
      color:
        (typeof link.color === 'string' && link.color) ||
        linkTypeColors[slotTypeKey(link.type)] ||
        defaultLinkColor
    })
  }
  return layoutHiddenLinkBadges(host, ctx, hiddenLinks, scope.owningGraphId)
}
