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

/**
 * Topologically sorts subgraph definitions so that leaf subgraphs (those
 * that no other subgraph depends on) are configured first. This ensures
 * that when a SubgraphNode is configured, the subgraph definition it
 * references already has its nodes, links, and inputs populated.
 *
 * Falls back to the original order if no reordering is needed or if the
 * dependency graph contains cycles.
 */
export function topologicalSortSubgraphs(
  subgraphs: ExportedSubgraph[]
): ExportedSubgraph[] {
  const subgraphIds = new Set(subgraphs.map((sg) => sg.id))
  const byId = new Map(subgraphs.map((sg) => [sg.id, sg]))

  // Build adjacency: dependency → set of dependents (parents that use it).
  // Edges go from leaf to parent so Kahn's emits leaves first.
  const dependents = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  for (const id of subgraphIds) {
    dependents.set(id, new Set())
    inDegree.set(id, 0)
  }

  for (const sg of subgraphs) {
    for (const node of sg.nodes ?? []) {
      if (subgraphIds.has(node.type)) {
        // sg depends on node.type → edge from node.type to sg.id
        dependents.get(node.type)!.add(sg.id)
        inDegree.set(sg.id, (inDegree.get(sg.id) ?? 0) + 1)
      }
    }
  }

  // Kahn's algorithm — leaves (in-degree 0) are emitted first.
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: ExportedSubgraph[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(byId.get(id)!)
    for (const dependent of dependents.get(id) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) queue.push(dependent)
    }
  }

  // Cycle fallback: return original order
  if (sorted.length !== subgraphs.length) return subgraphs

  return sorted
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
