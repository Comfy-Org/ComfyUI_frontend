import type { LGraph, LGraphState } from '../LGraph'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type {
  ExportedSubgraph,
  ExposedWidget,
  ISerialisedNode,
  SerialisableLLink
} from '../types/serialisation'

const MAX_ID = 100_000_000

interface DeduplicationResult {
  subgraphs: ExportedSubgraph[]
  rootNodes: ISerialisedNode[] | undefined
}

/**
 * Dedupes node IDs across serialized subgraph definitions to prevent widget
 * store key collisions, and patches any root-level legacy proxyWidgets that
 * reference the remapped inner IDs. Returns deep clones; inputs are not
 * mutated. `state.lastNodeId` is advanced.
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
  const usedNodeIdKeys = new Set<NodeId>([...reservedNodeIds].map(toNodeId))
  const subgraphIdSet = new Set(clonedSubgraphs.map((sg) => sg.id))
  const remapBySubgraph = new Map<string, Map<NodeId, SerializedNodeId>>()

  for (const subgraph of clonedSubgraphs) {
    const remappedIds = remapNodeIds(
      subgraph.nodes ?? [],
      usedNodeIdKeys,
      usedNodeIds,
      state
    )

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
  usedNodeIdKeys: Set<NodeId>,
  usedNodeIds: Set<number>,
  state: LGraphState
): Map<NodeId, SerializedNodeId> {
  const remappedIds = new Map<NodeId, SerializedNodeId>()

  for (const node of nodes) {
    const id = node.id
    const key = toNodeId(id)
    const numericId = numericSerializedNodeId(id)

    if (usedNodeIdKeys.has(key)) {
      const newId = findNextAvailableId(usedNodeIds, () => ++state.lastNodeId)
      remappedIds.set(key, newId)
      node.id = newId
      usedNodeIds.add(newId)
      usedNodeIdKeys.add(toNodeId(newId))
      console.warn(
        `LiteGraph: duplicate subgraph node ID ${id} remapped to ${newId}`
      )
    } else {
      usedNodeIdKeys.add(key)
      if (numericId !== null) {
        usedNodeIds.add(numericId)
        if (numericId > state.lastNodeId) state.lastNodeId = numericId
      }
    }
  }

  return remappedIds
}

/** Parses a serialized node ID as an integer, or `null` when non-numeric. */
function numericSerializedNodeId(id: SerializedNodeId): number | null {
  const key = toNodeId(id)
  const numericId = Number(key)
  return Number.isInteger(numericId) && String(numericId) === key
    ? numericId
    : null
}

/**
 * Finds the next unused ID by repeatedly calling `advance`.
 * Throws if the ID space is exhausted.
 */
function findNextAvailableId(
  usedIds: Set<number>,
  advance: () => number
): number {
  while (true) {
    const nextId = advance()
    if (nextId > MAX_ID) {
      throw new Error('Node ID space exhausted')
    }
    if (!usedIds.has(nextId)) return nextId
  }
}

/** Patches origin_id / target_id in serialized links. */
function patchSerialisedLinks(
  links: SerialisableLLink[],
  remappedIds: Map<NodeId, SerializedNodeId>
): void {
  for (const link of links) {
    const newOrigin = remappedIds.get(toNodeId(link.origin_id))
    if (newOrigin !== undefined) link.origin_id = newOrigin

    const newTarget = remappedIds.get(toNodeId(link.target_id))
    if (newTarget !== undefined) link.target_id = newTarget
  }
}

/** Patches promoted widget node references. */
function patchPromotedWidgets(
  widgets: ExposedWidget[],
  remappedIds: Map<NodeId, SerializedNodeId>
): void {
  for (const widget of widgets) {
    const newId = remappedIds.get(toNodeId(widget.id))
    if (newId !== undefined) widget.id = newId
  }
}

/**
 * Collects every reroute ID in use by a root graph and its subgraphs, for
 * use as the reserved set of {@link deduplicateSubgraphRerouteIds}.
 */
export function collectReservedRerouteIds(
  graph: Pick<LGraph, 'reroutes' | 'subgraphs'>
): Set<number> {
  const reserved = new Set<number>()
  for (const reroute of graph.reroutes.values()) {
    reserved.add(Number(reroute.id))
  }
  for (const subgraph of graph.subgraphs.values()) {
    for (const reroute of subgraph.reroutes.values()) {
      reserved.add(Number(reroute.id))
    }
  }
  return reserved
}

/**
 * Dedupes reroute IDs across serialized subgraph definitions. Reroute IDs
 * must be unique within a root graph: the reroute store keys every reroute
 * in a root graph (its subgraphs' included) in one bucket, but subgraph
 * definitions from older frontends or external tools may number their
 * reroutes from scratch. Remaps colliding IDs in place and patches every
 * reference within the subgraph (`reroute.parentId`, `link.parentId`),
 * advancing `state.lastRerouteId`.
 */
export function deduplicateSubgraphRerouteIds(
  subgraphs: ExportedSubgraph[],
  reservedRerouteIds: Set<number>,
  state: LGraphState
): void {
  const usedRerouteIds = new Set(reservedRerouteIds)
  for (const id of reservedRerouteIds) reserveRerouteId(id, state)

  for (const subgraph of subgraphs) {
    const remapped = remapRerouteIds(subgraph, usedRerouteIds, state)
    if (remapped.size > 0) patchRerouteReferences(subgraph, remapped)
  }
}

/** Advances `state.lastRerouteId` so future allocations skip `id`. */
function reserveRerouteId(id: number, state: LGraphState): void {
  if (id > state.lastRerouteId) state.lastRerouteId = toRerouteId(id)
}

/**
 * Remaps duplicate reroute IDs to unique values, updating `usedRerouteIds`
 * and `state.lastRerouteId` as new IDs are allocated.
 * @returns A map of old ID → new ID for reroutes that were remapped.
 */
function remapRerouteIds(
  subgraph: ExportedSubgraph,
  usedRerouteIds: Set<number>,
  state: LGraphState
): Map<number, number> {
  const remapped = new Map<number, number>()

  for (const reroute of subgraph.reroutes ?? []) {
    if (usedRerouteIds.has(reroute.id)) {
      const newId = findNextAvailableId(usedRerouteIds, () => {
        state.lastRerouteId = toRerouteId(state.lastRerouteId + 1)
        return state.lastRerouteId
      })
      remapped.set(reroute.id, newId)
      console.warn(
        `LiteGraph: duplicate subgraph reroute ID ${reroute.id} remapped to ${newId}`
      )
      reroute.id = newId
      usedRerouteIds.add(newId)
    } else {
      usedRerouteIds.add(reroute.id)
      reserveRerouteId(reroute.id, state)
    }
  }

  return remapped
}

/** Patches every reference to a remapped reroute ID within a subgraph. */
function patchRerouteReferences(
  subgraph: ExportedSubgraph,
  remapped: Map<number, number>
): void {
  for (const reroute of subgraph.reroutes ?? []) {
    if (reroute.parentId === undefined) continue
    const newParentId = remapped.get(reroute.parentId)
    if (newParentId !== undefined) reroute.parentId = newParentId
  }
  for (const link of [
    ...(subgraph.links ?? []),
    ...(subgraph.floatingLinks ?? [])
  ]) {
    if (link.parentId === undefined) continue
    const newParentId = remapped.get(link.parentId)
    if (newParentId !== undefined) link.parentId = toRerouteId(newParentId)
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

/** Patches legacy proxyWidgets in root-level SubgraphNode instances. */
function patchProxyWidgets(
  rootNodes: ISerialisedNode[],
  subgraphIdSet: Set<string>,
  remapBySubgraph: Map<string, Map<NodeId, SerializedNodeId>>
): void {
  for (const node of rootNodes) {
    if (!subgraphIdSet.has(node.type)) continue
    const remappedIds = remapBySubgraph.get(node.type)
    if (!remappedIds) continue

    const proxyWidgets = node.properties?.proxyWidgets
    if (!Array.isArray(proxyWidgets)) continue

    for (const entry of proxyWidgets) {
      if (!Array.isArray(entry)) continue
      const oldId = toNodeId(entry[0])
      const newId = remappedIds.get(oldId)
      if (newId !== undefined) entry[0] = String(newId)
    }
  }
}
