import type { LGraph } from '../LGraph'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import { toGroupId } from '@/types/groupId'
import {
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId
} from '../idAllocation'
import type { LGraphState } from '../idAllocation'
import {
  normalizeConfiguredTopology,
  remapLinkReferences
} from '../linkDeduplication'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'
import type {
  ExportedSubgraph,
  ExposedWidget,
  ISerialisedGroup,
  ISerialisedNode,
  SerialisableLLink
} from '../types/serialisation'

const MAX_ID = 100_000_000

interface DeduplicationResult<
  Subgraph extends { id: string; nodes?: { type: string }[] } =
    ExportedSubgraph,
  Node extends { type: string } = ISerialisedNode
> {
  subgraphs: Subgraph[]
  rootNodes: Node[] | undefined
}

interface SubgraphNormalizationReservations {
  nodeIds: Set<NodeId>
  groupIds: Set<number>
  linkIds: Set<number>
  rerouteIds: Set<number>
}

export function normalizeSubgraphDefinitions(
  subgraphs: ExportedSubgraph[],
  reservations: SubgraphNormalizationReservations,
  state: LGraphState,
  rootNodes?: ISerialisedNode[]
): DeduplicationResult {
  const normalizedIds = normalizeSubgraphDefinitionIds(subgraphs, rootNodes)
  const clonedSubgraphs =
    firstById(normalizedIds.subgraphs, (subgraph) => subgraph.id, 'subgraph') ??
    []
  const clonedRootNodes = normalizedIds.rootNodes

  for (const [index, subgraph] of clonedSubgraphs.entries()) {
    dropSameOwnerDuplicates(subgraph)
    clonedSubgraphs[index] = normalizeConfiguredTopology(subgraph)
  }

  deduplicateClonedSubgraphNodeIds(
    clonedSubgraphs,
    reservations.nodeIds,
    state,
    clonedRootNodes
  )
  deduplicateSubgraphGroupIds(clonedSubgraphs, reservations.groupIds, state)
  deduplicateSubgraphLinkIds(clonedSubgraphs, reservations.linkIds, state)
  deduplicateSubgraphRerouteIds(clonedSubgraphs, reservations.rerouteIds, state)

  return { subgraphs: clonedSubgraphs, rootNodes: clonedRootNodes }
}

export function normalizeSubgraphDefinitionIds<
  Subgraph extends { id: string; nodes?: { type: string }[] },
  Node extends { type: string }
>(
  subgraphs: Subgraph[],
  rootNodes?: Node[]
): DeduplicationResult<Subgraph, Node> {
  const clonedSubgraphs = structuredClone(subgraphs)
  const clonedRootNodes = rootNodes ? structuredClone(rootNodes) : undefined
  const ids = new Set(clonedSubgraphs.map(({ id }) => id))
  const remapped = new Map<string, string>()

  for (const subgraph of clonedSubgraphs) {
    if (isUuidShapedSubgraphId(subgraph.id)) continue
    let id = remapped.get(subgraph.id)
    if (!id) {
      do id = createUuidv4()
      while (ids.has(id))
      remapped.set(subgraph.id, id)
      ids.add(id)
      console.warn(
        `LiteGraph: replaced legacy subgraph ID ${subgraph.id} with ${id}`
      )
    }
    subgraph.id = id
  }

  for (const node of [
    ...(clonedRootNodes ?? []),
    ...clonedSubgraphs.flatMap(({ nodes }) => nodes ?? [])
  ]) {
    node.type = remapped.get(node.type) ?? node.type
  }

  return { subgraphs: clonedSubgraphs, rootNodes: clonedRootNodes }
}

function dropSameOwnerDuplicates(subgraph: ExportedSubgraph): void {
  subgraph.nodes = firstById(
    subgraph.nodes,
    (node) => toNodeId(node.id),
    'node'
  )
  subgraph.groups = firstById(subgraph.groups, (group) => group.id, 'group')

  const seenLinkIds = new Set<number>()
  subgraph.links = firstById(
    subgraph.links,
    (link) => link.id,
    'link',
    seenLinkIds
  )
  subgraph.floatingLinks = firstById(
    subgraph.floatingLinks,
    (link) => link.id,
    'link',
    seenLinkIds
  )
  subgraph.reroutes = firstById(
    subgraph.reroutes,
    (reroute) => reroute.id,
    'reroute'
  )
}

function firstById<T, Id>(
  items: T[] | undefined,
  idOf: (item: T) => Id,
  entity: 'subgraph' | 'node' | 'group' | 'link' | 'reroute',
  seen = new Set<Id>()
): T[] | undefined {
  if (!items) return undefined
  return items.filter((item) => {
    const id = idOf(item)
    if (!seen.has(id)) {
      seen.add(id)
      return true
    }
    console.warn(
      `LiteGraph: duplicate ${entity} ID ${String(id)} in one subgraph; keeping first`
    )
    return false
  })
}

/**
 * Dedupes node IDs across serialized subgraph definitions to prevent widget
 * store key collisions, and patches any root-level legacy proxyWidgets that
 * reference the remapped inner IDs. Returns deep clones; inputs are not
 * mutated. `state.lastNodeId` is advanced.
 *
 * `GraphCanvas.vue` also keys Vue node instances by bare `NodeId`, so
 * collisions could reuse a component across graph changes instead of
 * remounting it.
 */
export function deduplicateSubgraphNodeIds(
  subgraphs: ExportedSubgraph[],
  reservedNodeIds: Set<number>,
  state: LGraphState,
  rootNodes?: ISerialisedNode[]
): DeduplicationResult {
  const clonedSubgraphs = structuredClone(subgraphs)
  const clonedRootNodes = rootNodes ? structuredClone(rootNodes) : undefined

  deduplicateClonedSubgraphNodeIds(
    clonedSubgraphs,
    new Set([...reservedNodeIds].map(toNodeId)),
    state,
    clonedRootNodes
  )

  return { subgraphs: clonedSubgraphs, rootNodes: clonedRootNodes }
}

function deduplicateClonedSubgraphNodeIds(
  clonedSubgraphs: ExportedSubgraph[],
  reservedNodeIdKeys: Set<NodeId>,
  state: LGraphState,
  clonedRootNodes?: ISerialisedNode[]
): void {
  const usedNodeIdKeys = new Set(reservedNodeIdKeys)
  const usedNodeIds = new Set<number>()
  for (const id of reservedNodeIdKeys) {
    const numericId = numericSerializedNodeId(id)
    if (numericId !== null) usedNodeIds.add(numericId)
  }
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

    patchSerialisedLinks(
      [...(subgraph.links ?? []), ...(subgraph.floatingLinks ?? [])],
      remappedIds
    )
    patchPromotedWidgets(subgraph.widgets ?? [], remappedIds)
  }

  for (const subgraph of clonedSubgraphs) {
    patchProxyWidgets(subgraph.nodes ?? [], subgraphIdSet, remapBySubgraph)
  }

  if (clonedRootNodes) {
    patchProxyWidgets(clonedRootNodes, subgraphIdSet, remapBySubgraph)
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
      const newId = findNextAvailableId(usedNodeIds, () =>
        Number(mintNodeId(state))
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
        observeNodeId(state, toNodeId(numericId))
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

export function collectReservedGroupIds(
  graph: Pick<LGraph, 'groups' | 'subgraphs'>,
  serializedGroups: ISerialisedGroup[] = []
): Set<number> {
  return new Set<number>([
    ...serializedGroups.map((group) => group.id),
    ...[graph, ...graph.subgraphs.values()].flatMap((g) =>
      g.groups.map((group) => group.id)
    )
  ])
}

export function collectReservedLinkIds(
  graph: Pick<LGraph, 'links' | 'floatingLinks' | 'subgraphs'>,
  serializedFloatingLinks: SerialisableLLink[] = []
): Set<number> {
  return new Set([
    ...serializedFloatingLinks.map((link) => link.id),
    ...[graph, ...graph.subgraphs.values()].flatMap((owner) => [
      ...owner.links.keys(),
      ...owner.floatingLinks.keys()
    ])
  ])
}

export function deduplicateSubgraphLinkIds(
  subgraphs: ExportedSubgraph[],
  reservedLinkIds: Set<number>,
  state: LGraphState
): void {
  const usedLinkIds = new Set(reservedLinkIds)
  for (const id of reservedLinkIds) observeLinkId(state, toLinkId(id))

  for (const subgraph of subgraphs) {
    const remapped = remapNumericIds(
      [...(subgraph.links ?? []), ...(subgraph.floatingLinks ?? [])],
      usedLinkIds,
      () => mintLinkId(state),
      (id) => observeLinkId(state, toLinkId(id)),
      'link'
    )
    if (remapped.size > 0) remapLinkReferences(subgraph, remapped)
  }
}

/**
 * Dedupes group IDs across serialized subgraph definitions. Groups have no
 * ID-based references to patch, but their layout-store keys share the root
 * graph scope and therefore require root-wide IDs.
 */
export function deduplicateSubgraphGroupIds(
  subgraphs: ExportedSubgraph[],
  reservedGroupIds: Set<number>,
  state: LGraphState
): void {
  const usedGroupIds = new Set(reservedGroupIds)
  for (const id of reservedGroupIds) observeGroupId(state, toGroupId(id))

  for (const subgraph of subgraphs) {
    remapNumericIds(
      subgraph.groups ?? [],
      usedGroupIds,
      () => mintGroupId(state),
      (id) => observeGroupId(state, toGroupId(id)),
      'group'
    )
  }
}

export function collectReservedRerouteIds(
  graph: Pick<LGraph, 'reroutes' | 'subgraphs'>
): Set<number> {
  return new Set<number>(
    [graph, ...graph.subgraphs.values()].flatMap((g) =>
      [...g.reroutes.values()].map((reroute) => reroute.id)
    )
  )
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
  for (const id of reservedRerouteIds) observeRerouteId(state, toRerouteId(id))

  for (const subgraph of subgraphs) {
    const remapped = remapRerouteIds(subgraph, usedRerouteIds, state)
    if (remapped.size > 0) patchRerouteReferences(subgraph, remapped)
  }
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
  return remapNumericIds(
    subgraph.reroutes ?? [],
    usedRerouteIds,
    () => mintRerouteId(state),
    (id) => observeRerouteId(state, toRerouteId(id)),
    'reroute'
  )
}

function remapNumericIds<T extends { id: number }>(
  items: T[],
  usedIds: Set<number>,
  nextId: () => number,
  reserveId: (id: number) => void,
  entity: 'group' | 'link' | 'reroute'
): Map<number, number> {
  const remapped = new Map<number, number>()

  for (const item of items) {
    const oldId = item.id
    if (usedIds.has(oldId)) {
      const newId = findNextAvailableId(usedIds, nextId)
      remapped.set(oldId, newId)
      item.id = newId
      usedIds.add(newId)
      console.warn(
        `LiteGraph: duplicate subgraph ${entity} ID ${oldId} remapped to ${newId}`
      )
    } else {
      usedIds.add(oldId)
      reserveId(oldId)
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
