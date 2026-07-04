import { toLinkId } from '@/types/linkId'
import type { LGraphState } from '../LGraph'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
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
 * Dedupes node and link IDs across serialized subgraph definitions so every
 * node and link in a root graph has a unique id. Subgraph definitions each
 * number their entities from scratch, but the widget store keys node widgets
 * and the link store keys links in one root-scoped bucket, so colliding ids
 * would clobber each other's entries. Returns deep clones; inputs are not
 * mutated. `state.lastNodeId` and `state.lastLinkId` are advanced.
 */
export function deduplicateSubgraphIds(
  subgraphs: ExportedSubgraph[],
  reservedNodeIds: Set<number>,
  reservedLinkIds: Set<number>,
  state: LGraphState,
  rootNodes?: ISerialisedNode[]
): DeduplicationResult {
  const result = deduplicateSubgraphNodeIds(
    subgraphs,
    reservedNodeIds,
    state,
    rootNodes
  )
  deduplicateSubgraphLinkIds(result.subgraphs, reservedLinkIds, state)
  return result
}

/**
 * Dedupes node IDs across serialized subgraph definitions to prevent widget
 * store key collisions, and patches any root-level legacy proxyWidgets that
 * reference the remapped inner IDs. Returns deep clones; inputs are not
 * mutated. `state.lastNodeId` is advanced.
 */
function deduplicateSubgraphNodeIds(
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
 * Dedupes link IDs across serialized subgraph definitions. Mutates the given
 * subgraphs in place — only ever called on the clones produced by
 * {@link deduplicateSubgraphNodeIds} — and advances `state.lastLinkId`.
 */
function deduplicateSubgraphLinkIds(
  subgraphs: ExportedSubgraph[],
  reservedLinkIds: Set<number>,
  state: LGraphState
): void {
  const usedLinkIds = new Set(reservedLinkIds)
  for (const id of reservedLinkIds) reserveLinkId(id, state)

  for (const subgraph of subgraphs) {
    const remapped = remapLinkIds(subgraph, usedLinkIds, state)
    if (remapped.size > 0) patchLinkReferences(subgraph, remapped)
  }
}

function reserveLinkId(id: number, state: LGraphState): void {
  if (id > state.lastLinkId) state.lastLinkId = toLinkId(id)
}

/**
 * Remaps a subgraph's colliding link and floating-link IDs to fresh values,
 * updating `usedLinkIds` and `state.lastLinkId`.
 * @returns A map of old ID → new ID for links that were remapped.
 */
function remapLinkIds(
  subgraph: ExportedSubgraph,
  usedLinkIds: Set<number>,
  state: LGraphState
): Map<number, number> {
  const remapped = new Map<number, number>()

  for (const link of [
    ...(subgraph.links ?? []),
    ...(subgraph.floatingLinks ?? [])
  ]) {
    if (usedLinkIds.has(link.id)) {
      const newId = findNextAvailableId(
        usedLinkIds,
        () => (state.lastLinkId = toLinkId(state.lastLinkId + 1)),
        'Link'
      )
      remapped.set(link.id, newId)
      link.id = newId
      usedLinkIds.add(newId)
    } else {
      usedLinkIds.add(link.id)
      reserveLinkId(link.id, state)
    }
  }

  return remapped
}

/** Patches every reference to a remapped link ID within a subgraph. */
function patchLinkReferences(
  subgraph: ExportedSubgraph,
  remapped: Map<number, number>
): void {
  const remap = (id: number) => remapped.get(id) ?? id

  for (const node of subgraph.nodes ?? []) {
    for (const input of node.inputs ?? []) {
      if (input.link != null) input.link = remap(input.link)
    }
    for (const output of node.outputs ?? []) {
      if (output.links) output.links = output.links.map(remap)
    }
  }
  for (const slot of [
    ...(subgraph.inputs ?? []),
    ...(subgraph.outputs ?? [])
  ]) {
    if (slot.linkIds) slot.linkIds = slot.linkIds.map(remap)
  }
  for (const reroute of subgraph.reroutes ?? []) {
    reroute.linkIds = reroute.linkIds.map(remap)
  }
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
      const newId = findNextAvailableId(
        usedNodeIds,
        () => ++state.lastNodeId,
        'Node'
      )
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
  advance: () => number,
  entity: 'Node' | 'Link'
): number {
  while (true) {
    const nextId = advance()
    if (nextId > MAX_ID) {
      throw new Error(`${entity} ID space exhausted`)
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
