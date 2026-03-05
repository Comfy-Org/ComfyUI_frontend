import { LLink } from '@/lib/litegraph/src/LLink'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableReroute
} from '@/lib/litegraph/src/types/serialisation'

type GraphStateLike = {
  lastGroupId: number
  lastLinkId: number
  lastNodeId: number
  lastRerouteId: number
}

type LinkNodeEndpoint = {
  origin_id: NodeId
  target_id: NodeId
}

type ConfiguredTopology = {
  links: LLink[]
  reroutes: SerialisableReroute[] | undefined
}

function mergeStateByMax(
  state: GraphStateLike,
  configuredState: SerialisableGraph['state'] | undefined
): void {
  if (!configuredState) return

  const { lastGroupId, lastLinkId, lastNodeId, lastRerouteId } = configuredState
  if (lastGroupId != null)
    state.lastGroupId = Math.max(state.lastGroupId, lastGroupId)
  if (lastLinkId != null)
    state.lastLinkId = Math.max(state.lastLinkId, lastLinkId)
  if (lastNodeId != null)
    state.lastNodeId = Math.max(state.lastNodeId, lastNodeId)
  if (lastRerouteId != null)
    state.lastRerouteId = Math.max(state.lastRerouteId, lastRerouteId)
}

function toConfiguredTopology(
  data: ISerialisedGraph | SerialisableGraph,
  state: GraphStateLike
): ConfiguredTopology {
  if (data.version === 0.4) {
    const links = Array.isArray(data.links)
      ? data.links.map((linkData) => LLink.createFromArray(linkData))
      : []

    const linkMap = new Map(links.map((link) => [link.id, link]))
    if (Array.isArray(data.extra?.linkExtensions)) {
      for (const linkExtension of data.extra.linkExtensions) {
        const link = linkMap.get(linkExtension.id)
        if (link) link.parentId = linkExtension.parentId
      }
    }

    return {
      links,
      reroutes: data.extra?.reroutes
    }
  }

  mergeStateByMax(state, data.state)
  return {
    links: Array.isArray(data.links)
      ? data.links.map((linkData) => LLink.create(linkData))
      : [],
    reroutes: data.reroutes
  }
}

function patchLinkNodeIds(
  links: Iterable<LinkNodeEndpoint> | undefined,
  remappedIds: ReadonlyMap<NodeId, NodeId>
): void {
  if (!links) return

  for (const link of links) {
    const newOriginId = remappedIds.get(link.origin_id)
    if (newOriginId !== undefined) link.origin_id = newOriginId

    const newTargetId = remappedIds.get(link.target_id)
    if (newTargetId !== undefined) link.target_id = newTargetId
  }
}

function remapNodeId(
  nodeId: string,
  remappedIds: ReadonlyMap<NodeId, NodeId>
): NodeId | undefined {
  const directMatch = remappedIds.get(nodeId)
  if (directMatch !== undefined) return directMatch
  if (!/^-?\d+$/.test(nodeId)) return undefined

  const numericId = Number(nodeId)
  if (!Number.isSafeInteger(numericId)) return undefined
  return remappedIds.get(numericId)
}

function remapProxyWidgets(
  info: ISerialisedNode,
  remappedIds: ReadonlyMap<NodeId, NodeId> | undefined
): void {
  if (!remappedIds || remappedIds.size === 0) return

  const proxyWidgets = info.properties?.proxyWidgets
  if (!Array.isArray(proxyWidgets)) return

  for (const entry of proxyWidgets) {
    if (!Array.isArray(entry)) continue

    const [nodeId] = entry
    if (typeof nodeId !== 'string' || nodeId === '-1') continue

    const remappedNodeId = remapNodeId(nodeId, remappedIds)
    if (remappedNodeId !== undefined) entry[0] = String(remappedNodeId)
  }
}

export const graphPersistenceAdapter = {
  toConfiguredTopology,
  patchLinkNodeIds,
  remapProxyWidgets
}
