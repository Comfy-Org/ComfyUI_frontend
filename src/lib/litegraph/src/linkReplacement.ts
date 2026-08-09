import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { mintLinkId } from '@/types/idAllocation'
import type { LGraphState } from '@/types/idAllocation'
import type { NodeId } from '@/types/nodeId'

import type { LinkNetwork } from './interfaces'
import { LLink } from './LLink'

export interface LinkEndpoints {
  originId: NodeId
  originSlot: number
  targetId: NodeId
  targetSlot: number
}

export function completeFloatingLink(
  graph: LinkNetwork,
  oldLink: LLink,
  replacement: LLink
): LLink {
  replacement.data = oldLink.data
  replacement._data = oldLink._data
  if (oldLink.color) replacement.color = oldLink.color

  graph.removeFloatingLink(oldLink)
  layoutStore.deleteLinkLayout(oldLink.id)
  return replacement
}

type ReplacementNetwork = LinkNetwork & {
  state: LGraphState
  _addLink(link: LLink): void
}

function isReplacementNetwork(graph: LinkNetwork): graph is ReplacementNetwork {
  return 'state' in graph && '_addLink' in graph
}

export function replaceFloatingLink(
  graph: LinkNetwork,
  oldLink: LLink,
  endpoints: LinkEndpoints
): LLink {
  if (!isReplacementNetwork(graph)) {
    throw new Error('Link replacement requires a graph-backed network')
  }
  if (graph.floatingLinks.get(oldLink.id) !== oldLink) {
    throw new Error('Link replacement requires a registered floating link')
  }

  const replacement = new LLink(
    mintLinkId(graph.state),
    oldLink.type,
    endpoints.originId,
    endpoints.originSlot,
    endpoints.targetId,
    endpoints.targetSlot,
    oldLink.parentId
  )
  if (replacement.isFloating) {
    graph.addFloatingLink(replacement)
  } else {
    graph._addLink(replacement)
  }

  return completeFloatingLink(graph, oldLink, replacement)
}
