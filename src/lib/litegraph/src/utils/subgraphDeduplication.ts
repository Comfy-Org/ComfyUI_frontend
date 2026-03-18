import type { LGraphState } from '../LGraph'
import type { NodeId } from '../LGraphNode'
import type {
  ExportedSubgraph,
  ExposedWidget,
  ISerialisedNode,
  SerialisableLLink
} from '../types/serialisation'

const MAX_NODE_ID = 100_000_000

interface DeduplicationResult {
  subgraphs: ExportedSubgraph[]
  rootNodes: ISerialisedNode[] | undefined
}

/**
 * Pre-deduplicates node IDs across serialized subgraph definitions before
 * they are configured. This prevents widget store key collisions when
 * multiple subgraph copies contain nodes with the same IDs.
 *
 * Also patches proxyWidgets in root-level nodes that reference the
 * remapped inner node IDs.
 *
 * Returns deep clones of the inputs — the originals are never mutated.
 *
 * @param subgraphs - Serialized subgraph definitions to deduplicate
 * @param reservedNodeIds - Node IDs already in use by root-level nodes
 * @param state - Graph state containing the `lastNodeId` counter (mutated)
 * @param rootNodes - Optional root-level nodes with proxyWidgets to patch
 */
export function deduplicateSubgraphNodeIds(
  subgraphs: ExportedSubgraph[],
  reservedNodeIds: Set<number>,
  state: LGraphState,
  rootNodes?: ISerialisedNode[]
): DeduplicationResult {
  const clonedSubgraphs = structuredClone(subgraphs)
  const clonedRootNodes = rootNodes ? structuredClone(rootNodes) : undefined

  const usedNodeIds = new Set(reservedNodeIds)
  const subgraphIdSet = new Set(clonedSubgraphs.map((sg) => sg.id))
  const remapBySubgraph = new Map<string, Map<NodeId, NodeId>>()

  for (const subgraph of clonedSubgraphs) {
    const remappedIds = remapNodeIds(subgraph.nodes ?? [], usedNodeIds, state)

    if (remappedIds.size === 0) continue
    remapBySubgraph.set(subgraph.id, remappedIds)

    patchSerialisedLinks(subgraph.links ?? [], remappedIds)
    patchPromotedWidgets(subgraph.widgets ?? [], remappedIds)
  }

  for (const subgraph of clonedSubgraphs) {
    patchProxyWidgets(subgraph.nodes ?? [], subgraphIdSet, remapBySubgraph)
  }

  if (clonedRootNodes) {
    patchProxyWidgets(clonedRootNodes, subgraphIdSet, remapBySubgraph)
  }

  return { subgraphs: clonedSubgraphs, rootNodes: clonedRootNodes }
}

/**
 * Remaps duplicate node IDs to unique values, updating `usedNodeIds`
 * and `state.lastNodeId` as new IDs are allocated.
 *
 * @returns A map of old ID → new ID for nodes that were remapped.
 */
function remapNodeIds(
  nodes: ISerialisedNode[],
  usedNodeIds: Set<number>,
  state: LGraphState
): Map<NodeId, NodeId> {
  const remappedIds = new Map<NodeId, NodeId>()

  for (const node of nodes) {
    const id = node.id
    if (typeof id !== 'number') continue

    if (usedNodeIds.has(id)) {
      const newId = findNextAvailableId(usedNodeIds, state)
      remappedIds.set(id, newId)
      node.id = newId
      usedNodeIds.add(newId as number)
      console.warn(
        `LiteGraph: duplicate subgraph node ID ${id} remapped to ${newId}`
      )
    } else {
      usedNodeIds.add(id)
      if (id > state.lastNodeId) state.lastNodeId = id
    }
  }

  return remappedIds
}

/**
 * Finds the next unused node ID by incrementing `state.lastNodeId`.
 * Throws if the ID space is exhausted.
 */
function findNextAvailableId(
  usedNodeIds: Set<number>,
  state: LGraphState
): NodeId {
  while (true) {
    const nextId = state.lastNodeId + 1
    if (nextId > MAX_NODE_ID) {
      throw new Error('Node ID space exhausted')
    }
    state.lastNodeId = nextId
    if (!usedNodeIds.has(nextId)) return nextId as NodeId
  }
}

/** Patches origin_id / target_id in serialized links. */
function patchSerialisedLinks(
  links: SerialisableLLink[],
  remappedIds: Map<NodeId, NodeId>
): void {
  for (const link of links) {
    const newOrigin = remappedIds.get(link.origin_id)
    if (newOrigin !== undefined) link.origin_id = newOrigin

    const newTarget = remappedIds.get(link.target_id)
    if (newTarget !== undefined) link.target_id = newTarget
  }
}

/** Patches promoted widget node references. */
function patchPromotedWidgets(
  widgets: ExposedWidget[],
  remappedIds: Map<NodeId, NodeId>
): void {
  for (const widget of widgets) {
    const newId = remappedIds.get(widget.id)
    if (newId !== undefined) widget.id = newId
  }
}

/** Patches proxyWidgets in root-level SubgraphNode instances. */
function patchProxyWidgets(
  rootNodes: ISerialisedNode[],
  subgraphIdSet: Set<string>,
  remapBySubgraph: Map<string, Map<NodeId, NodeId>>
): void {
  for (const node of rootNodes) {
    if (!subgraphIdSet.has(node.type)) continue
    const remappedIds = remapBySubgraph.get(node.type)
    if (!remappedIds) continue

    const proxyWidgets = node.properties?.proxyWidgets
    if (!Array.isArray(proxyWidgets)) continue

    for (const entry of proxyWidgets) {
      if (!Array.isArray(entry)) continue
      const oldId = Number(entry[0]) as NodeId
      const newId = remappedIds.get(oldId)
      if (newId !== undefined) entry[0] = String(newId)
    }
  }
}
