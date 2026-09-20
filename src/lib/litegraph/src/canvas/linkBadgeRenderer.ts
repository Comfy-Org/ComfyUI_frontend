import type { LGraph } from '../LGraph'
import type { LLink } from '../LLink'
import type { LinkId } from '@/types/linkId'
import type { LinkBadgeLayout } from './linkBadges'
import { graphScopeOf } from '@/types/graphScopeId'
import { compareNodeIds } from '@/types/nodeId'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { layoutHiddenLinkBadges, queryLinkBadgeAtPoint } from './linkBadges'
import { getLinkEndpointPositions } from './linkGeometry'

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

export function layoutGraphLinkBadges(
  host: object,
  ctx: CanvasRenderingContext2D,
  graph: LGraph,
  linkTypeColors: Readonly<Record<string | number, string>>,
  defaultLinkColor: string
): Map<LinkId, LinkBadgeLayout> {
  const scope = graphScopeOf(graph)
  const presentationStore = useLinkPresentationStore()
  const hiddenLinks: LLink[] = []
  for (const linkId of presentationStore.graphHiddenLinkIds(scope)) {
    const link = graph.getLink(linkId)
    if (link) hiddenLinks.push(link)
  }
  hiddenLinks.sort(
    (first, second) =>
      compareNodeIds(first.origin_id, second.origin_id) ||
      first.origin_slot - second.origin_slot ||
      first.id - second.id
  )
  const layouts = new Map<LinkId, LinkBadgeLayout>()
  for (const link of hiddenLinks) {
    const endpoints = getLinkEndpointPositions(graph, link)
    const presentation = presentationStore.getPresentation(scope, link.id)
    if (!endpoints || !presentation) continue

    const [startPos, endPos] = endpoints
    layouts.set(
      link.id,
      layoutHiddenLinkBadges(
        host,
        ctx,
        link,
        presentation,
        startPos,
        endPos,
        (typeof link.color === 'string' && link.color) ||
          linkTypeColors[link.type] ||
          defaultLinkColor
      )
    )
  }
  return layouts
}
