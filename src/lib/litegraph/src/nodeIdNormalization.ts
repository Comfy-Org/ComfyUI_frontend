import type { NodeId, NodeIdInput } from '@/types/nodeId'
import { asNodeId, tryAsNodeId } from '@/types/nodeId'

import type { LGraphState } from './LGraph'
import type { SerialisedLLinkArray } from './LLink'
import type {
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink
} from './types/serialisation'

const MAX_NODE_ID = 100_000_000

type ConfigurableGraphData = ISerialisedGraph | SerialisableGraph

/**
 * Reconciles arbitrary string node ids with the numeric `NodeId` contract.
 * Workflows persisted with non-integer string ids (e.g.
 * `"CheckpointLoaderSimple.0"`) only exist in the legacy v0.4 schema; each is
 * assigned a fresh numeric id from the graph counter — the same allocation
 * {@link LGraph.add} uses for unassigned nodes — and every link endpoint that
 * referenced it is patched to match.
 *
 * Newer schemas always carry numeric ids, so they pass through untouched and a
 * stray string id there fails loudly at `asNodeId`. Returns the input unchanged
 * when nothing needs remapping; otherwise returns a deep clone, leaving
 * reactive caller state unmutated.
 */
export function normalizeStringNodeIds<T extends ConfigurableGraphData>(
  data: T,
  state: LGraphState
): T {
  if (data.version !== 0.4) return data
  if (!data.nodes?.some((node) => isRemappableStringId(node.id))) return data

  const cloned = structuredClone(data)
  const nodes = cloned.nodes ?? []
  const usedNodeIds = collectNumericNodeIds(nodes)
  seedNodeIdCounter(cloned, state, usedNodeIds)

  const remap = new Map<string, NodeId>()
  for (const node of nodes) {
    if (!isRemappableStringId(node.id)) continue
    const newId = allocateNextNodeId(usedNodeIds, state)
    remap.set(String(node.id), newId)
    node.id = newId
  }

  patchArrayLinkEndpoints(cloned.links, remap)
  if ('last_node_id' in cloned) cloned.last_node_id = state.lastNodeId

  return cloned
}

function isRemappableStringId(
  id: NodeIdInput | null | undefined
): id is string {
  return typeof id === 'string' && tryAsNodeId(id) === null
}

function collectNumericNodeIds(nodes: ISerialisedNode[]): Set<number> {
  const ids = new Set<number>()
  for (const node of nodes) {
    const id = tryAsNodeId(node.id)
    if (id !== null && id >= 0) ids.add(id)
  }
  return ids
}

function seedNodeIdCounter(
  data: ConfigurableGraphData,
  state: LGraphState,
  usedNodeIds: Set<number>
): void {
  const serialized = 'last_node_id' in data ? data.last_node_id : 0
  let max = Math.max(state.lastNodeId, serialized)
  for (const id of usedNodeIds) if (id > max) max = id
  state.lastNodeId = max
}

function allocateNextNodeId(
  usedNodeIds: Set<number>,
  state: LGraphState
): NodeId {
  while (true) {
    const next = state.lastNodeId + 1
    if (next > MAX_NODE_ID)
      throw new Error('LiteGraph: node ID space exhausted')

    state.lastNodeId = next
    if (!usedNodeIds.has(next)) {
      usedNodeIds.add(next)
      return asNodeId(next)
    }
  }
}

function patchArrayLinkEndpoints(
  links: (SerialisedLLinkArray | SerialisableLLink)[] | undefined,
  remap: Map<string, NodeId>
): void {
  if (!links) return
  for (const link of links) {
    if (!Array.isArray(link)) continue

    const origin = remap.get(String(link[1]))
    if (origin !== undefined) link[1] = origin

    const target = remap.get(String(link[3]))
    if (target !== undefined) link[3] = target
  }
}
