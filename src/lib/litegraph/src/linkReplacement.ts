import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { mintLinkId } from '@/types/idAllocation'
import type { LGraphState } from '@/types/idAllocation'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from './LGraph'
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
  copyLinkPayload(oldLink, replacement)

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

function copyLinkPayload(oldLink: LLink, replacement: LLink): void {
  replacement.data = oldLink.data
  replacement._data = oldLink._data
  if (oldLink.color) replacement.color = oldLink.color
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
  copyLinkPayload(oldLink, replacement)
  if (replacement.isFloating) {
    graph.addFloatingLink(replacement)
  } else {
    graph._addLink(replacement)
  }

  return completeFloatingLink(graph, oldLink, replacement)
}

interface LinkEndpointReplacement {
  link: LLink
  endpoints: LinkEndpoints
}

interface LinkIdOwner {
  linkIds: LinkId[]
}

interface GraphWithIoSlots {
  inputs: LinkIdOwner[]
  outputs: LinkIdOwner[]
}

function hasIoSlots(graph: LGraph): graph is LGraph & GraphWithIoSlots {
  return 'inputNode' in graph && 'outputNode' in graph
}

function replaceLinkId(
  owners: readonly LinkIdOwner[],
  oldId: LinkId,
  newId: LinkId
): void {
  for (const { linkIds } of owners) {
    for (let index = 0; index < linkIds.length; index++) {
      if (linkIds[index] === oldId) linkIds[index] = newId
    }
  }
}

export function replaceLinkEndpoints(
  graph: LGraph,
  replacements: readonly LinkEndpointReplacement[],
  evictions: readonly LLink[] = []
): LLink[] {
  const oldLinks = [...replacements.map(({ link }) => link), ...evictions]
  for (const link of oldLinks) {
    const registered = link.isFloating
      ? graph.floatingLinks.get(link.id)
      : graph.links.get(link.id)
    if (registered !== link) {
      throw new Error(`Link ${link.id} is not registered in this graph`)
    }
  }
  const links = replacements.map(({ link, endpoints }) => {
    const replacement = new LLink(
      mintLinkId(graph.state),
      link.type,
      endpoints.originId,
      endpoints.originSlot,
      endpoints.targetId,
      endpoints.targetSlot,
      link.parentId
    )
    copyLinkPayload(link, replacement)
    return replacement
  })

  for (const link of oldLinks) {
    if (link.isFloating) {
      graph.removeFloatingLink(link)
      layoutStore.deleteLinkLayout(link.id)
    } else {
      graph._removeLink(link.id)
    }
  }

  for (const replacement of links) {
    if (replacement.isFloating) graph.addFloatingLink(replacement)
    else graph._addLink(replacement)
  }

  if (hasIoSlots(graph)) {
    const owners = [...graph.inputs, ...graph.outputs]
    replacements.forEach(({ link }, index) => {
      replaceLinkId(owners, link.id, links[index].id)
    })
  }

  return links
}
