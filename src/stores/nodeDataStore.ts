import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import { assert } from '@/base/assert'

import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

/** Maps a bucket's `(owning graph, node)` slots to whichever state claimed them. */
interface NodeKeyIndex {
  byNodeKey: Map<string, NodeState>
  keyOf: Map<NodeState, string>
}

function nodeKey(state: NodeState): string {
  return `${state.graphId}:${state.id}`
}

/**
 * One {@link NodeState} per node in root-graph-scoped buckets. Membership is by
 * state identity, so renumbering a registered node cannot strand its entry.
 * See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  const graphNodeStates = ref(new Map<UUID, Set<NodeState>>())
  /**
   * Bookkeeping for the one-state-per-node invariant. Deliberately outside the
   * reactive graph: it is never read by consumers, only asserted against.
   */
  const nodeKeyIndexes = new Map<UUID, NodeKeyIndex>()

  function getGraphNodes(rootGraphId: UUID): Set<NodeState> {
    const existing = graphNodeStates.value.get(rootGraphId)
    if (existing) return existing

    const created = reactive(new Set<NodeState>())
    graphNodeStates.value.set(rootGraphId, created)
    return created
  }

  function getNodeKeyIndex(rootGraphId: UUID): NodeKeyIndex {
    const existing = nodeKeyIndexes.get(rootGraphId)
    if (existing) return existing

    const created: NodeKeyIndex = { byNodeKey: new Map(), keyOf: new Map() }
    nodeKeyIndexes.set(rootGraphId, created)
    return created
  }

  /** Vacates the slot a state was indexed under — renumbering makes it unrecomputable. */
  function releaseNodeKey(index: NodeKeyIndex, state: NodeState): void {
    const key = index.keyOf.get(state)
    if (key === undefined) return

    index.keyOf.delete(state)
    if (index.byNodeKey.get(key) === state) index.byNodeKey.delete(key)
  }

  function registerNode(rootGraphId: UUID, state: NodeState): void {
    const raw = toRaw(state)
    const index = getNodeKeyIndex(rootGraphId)
    const key = nodeKey(raw)
    const claimant = index.byNodeKey.get(key)
    const claimantRenumbered =
      claimant !== undefined && nodeKey(claimant) !== key

    assert(
      claimant === undefined || claimant === raw || claimantRenumbered,
      `nodeDataStore: duplicate NodeState for node ${raw.id} in graph ${raw.graphId}`
    )

    releaseNodeKey(index, raw)
    index.byNodeKey.set(key, raw)
    index.keyOf.set(raw, key)
    getGraphNodes(rootGraphId).add(state)
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const bucket = graphNodeStates.value.get(rootGraphId)
    if (!bucket) return []
    return [...bucket].filter((state) => state.graphId === owningGraphId)
  }

  function deleteNode(rootGraphId: UUID, state: NodeState): boolean {
    const index = nodeKeyIndexes.get(rootGraphId)
    if (index) releaseNodeKey(index, toRaw(state))
    return graphNodeStates.value.get(rootGraphId)?.delete(state) ?? false
  }

  function clearGraph(rootGraphId: UUID): void {
    graphNodeStates.value.delete(rootGraphId)
    nodeKeyIndexes.delete(rootGraphId)
  }

  return {
    clearGraph,
    deleteNode,
    getGraphNodesFor,
    registerNode
  }
})
