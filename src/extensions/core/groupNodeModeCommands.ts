import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import {
  serializeNodeId,
  toNodeId,
  type SerializedNodeId
} from '@/types/nodeId'

const GROUP_NODE_MODE_COMMAND_TYPE = 'comfy.groupNodeMode.set'
const GROUP_NODE_MODE_COMMAND_VERSION = 1

const NODE_MODES: ReadonlySet<LGraphEventMode> = new Set([
  LGraphEventMode.ALWAYS,
  LGraphEventMode.ON_EVENT,
  LGraphEventMode.NEVER,
  LGraphEventMode.ON_TRIGGER,
  LGraphEventMode.BYPASS
])

interface GroupNodeModeCommandEntry {
  readonly nodeId: SerializedNodeId
  readonly mode: LGraphEventMode
}

/**
 * A serializable intent to set every node in a group to one execution mode.
 *
 * Node IDs and the graph ID make the batch deterministic and replayable; the
 * entries are sorted so equivalent groups serialize identically.
 */
export interface GroupNodeModeCommandBatch {
  readonly type: typeof GROUP_NODE_MODE_COMMAND_TYPE
  readonly version: typeof GROUP_NODE_MODE_COMMAND_VERSION
  readonly graphId: string
  readonly entries: readonly GroupNodeModeCommandEntry[]
}

function createEntries(
  nodes: readonly LGraphNode[],
  getMode: (node: LGraphNode) => LGraphEventMode
): GroupNodeModeCommandEntry[] {
  return nodes
    .map((node) => ({
      nodeId: serializeNodeId(node.id),
      mode: getMode(node)
    }))
    .sort(compareEntries)
}

function compareEntries(
  left: GroupNodeModeCommandEntry,
  right: GroupNodeModeCommandEntry
): number {
  return String(left.nodeId).localeCompare(String(right.nodeId), undefined, {
    numeric: true
  })
}

function createBatch(
  graphId: string,
  entries: readonly GroupNodeModeCommandEntry[]
): GroupNodeModeCommandBatch | null {
  if (
    !graphId ||
    entries.length === 0 ||
    entries.some((entry) => !NODE_MODES.has(entry.mode))
  ) {
    return null
  }

  const sortedEntries = [...entries].sort(compareEntries)
  const nodeIds = new Set(sortedEntries.map((entry) => String(entry.nodeId)))
  if (nodeIds.size !== sortedEntries.length) return null

  return {
    type: GROUP_NODE_MODE_COMMAND_TYPE,
    version: GROUP_NODE_MODE_COMMAND_VERSION,
    graphId,
    entries: sortedEntries
  }
}

export function createGroupNodeModeCommandBatch(
  graphId: string,
  nodes: readonly LGraphNode[],
  mode: LGraphEventMode
): GroupNodeModeCommandBatch | null {
  if (!NODE_MODES.has(mode) || nodes.length === 0) return null
  return createBatch(
    graphId,
    createEntries(nodes, () => mode)
  )
}

function resolveNodes(
  graph: LGraph,
  batch: GroupNodeModeCommandBatch
): LGraphNode[] | null {
  if (
    batch.type !== GROUP_NODE_MODE_COMMAND_TYPE ||
    batch.version !== GROUP_NODE_MODE_COMMAND_VERSION ||
    batch.graphId !== graph.id ||
    batch.entries.length === 0
  ) {
    return null
  }

  const nodes: LGraphNode[] = []
  const seenNodeIds = new Set<string>()
  for (const entry of batch.entries) {
    if (!NODE_MODES.has(entry.mode)) return null
    const nodeId = String(entry.nodeId)
    if (seenNodeIds.has(nodeId)) return null
    seenNodeIds.add(nodeId)

    const node = graph.getNodeById(toNodeId(entry.nodeId))
    if (!node) return null
    nodes.push(node)
  }
  return nodes
}

/**
 * Apply a command batch in one LiteGraph change transaction.
 *
 * Returns an inverse batch that can restore the previous modes. All node IDs
 * are resolved and validated before the first mutation, so an invalid replay
 * cannot partially modify a group.
 */
export function applyGroupNodeModeCommandBatch(
  graph: LGraph,
  batch: GroupNodeModeCommandBatch
): GroupNodeModeCommandBatch | null {
  const nodes = resolveNodes(graph, batch)
  if (!nodes) return null

  const inverse = createBatch(
    graph.id,
    createEntries(nodes, (node) => node.mode)
  )
  if (!inverse) return null

  graph.beforeChange()
  try {
    for (let index = 0; index < nodes.length; index++) {
      nodes[index].mode = batch.entries[index].mode
    }
    graph.change()
  } catch (error) {
    for (let index = 0; index < nodes.length; index++) {
      nodes[index].mode = inverse.entries[index].mode
    }
    graph.change()
    throw error
  } finally {
    graph.afterChange()
  }
  return inverse
}
