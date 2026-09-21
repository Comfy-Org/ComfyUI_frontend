import { defineStore } from 'pinia'
import { reactive, toRaw } from 'vue'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { NodeState } from '@/types/nodeState'
import type { NodeId } from '@/types/nodeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { UUID } from '@/utils/uuid'

/**
 * One {@link NodeState} per node in a root-flat, owner-indexed bucket.
 * See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  interface RootNodeBucket {
    byId: Map<NodeId, NodeState>
    idsByOwner: Map<OwningGraphId, Set<NodeId>>
  }

  const roots = reactive(new Map<RootGraphId, RootNodeBucket>())

  function rootBucket(rootGraphId: RootGraphId): RootNodeBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootNodeBucket>({
      byId: new Map(),
      idsByOwner: new Map()
    })
    roots.set(rootGraphId, created)
    return created
  }

  function scope(rootGraphId: UUID, owningGraphId: UUID) {
    return {
      rootGraphId: toRootGraphId(rootGraphId),
      owningGraphId: toOwningGraphId(owningGraphId)
    }
  }

  /**
   * @returns The registered state. Re-registering the same raw state under the
   * same owner returns the incumbent; `undefined` means a distinct state
   * occupies the node ID.
   */
  function registerNode(
    graphScope: GraphScope,
    state: NodeState,
    _context?: RemoteMutationContext
  ): NodeState | undefined {
    const existingBucket = roots.get(graphScope.rootGraphId)
    const incumbent = existingBucket?.byId.get(state.id)
    if (
      incumbent &&
      toRaw(incumbent) === toRaw(state) &&
      incumbent.graphId === graphScope.owningGraphId
    )
      return incumbent
    if (incumbent) return undefined
    const bucket = existingBucket ?? rootBucket(graphScope.rootGraphId)
    const registered: NodeState = reactive(
      Object.assign(state, { graphId: graphScope.owningGraphId })
    )
    bucket.byId.set(registered.id, registered)
    const ownerIds = bucket.idsByOwner.get(graphScope.owningGraphId)
    if (ownerIds) ownerIds.add(registered.id)
    else
      bucket.idsByOwner.set(
        graphScope.owningGraphId,
        reactive(new Set([registered.id]))
      )
    return registered
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const graphScope = scope(rootGraphId, owningGraphId)
    const bucket = roots.get(graphScope.rootGraphId)
    const ids = bucket?.idsByOwner.get(graphScope.owningGraphId)
    if (!bucket || !ids) return []
    return [...ids].flatMap((id) => {
      const state = bucket.byId.get(id)
      return state ? [state] : []
    })
  }

  function getNode(rootGraphId: UUID, nodeId: NodeId): NodeState | undefined {
    return roots.get(toRootGraphId(rootGraphId))?.byId.get(nodeId)
  }

  function ownsNode(graphScope: GraphScope, state: NodeState): boolean {
    const registered = roots.get(graphScope.rootGraphId)?.byId.get(state.id)
    return (
      registered?.graphId === graphScope.owningGraphId &&
      toRaw(registered) === toRaw(state)
    )
  }

  function deleteNode(
    graphScope: GraphScope,
    state: NodeState,
    _context?: RemoteMutationContext
  ): boolean {
    const bucket = roots.get(graphScope.rootGraphId)
    const registered = bucket?.byId.get(state.id)
    if (
      !bucket ||
      registered?.graphId !== graphScope.owningGraphId ||
      toRaw(registered) !== toRaw(state)
    )
      return false
    bucket.byId.delete(state.id)
    const ownerIds = bucket.idsByOwner.get(graphScope.owningGraphId)
    ownerIds?.delete(state.id)
    if (ownerIds?.size === 0) bucket.idsByOwner.delete(graphScope.owningGraphId)
    if (bucket.byId.size === 0) roots.delete(graphScope.rootGraphId)
    return true
  }

  function updateNodeSlots(
    graphScope: GraphScope,
    nodeId: NodeId,
    slots: Pick<NodeState, 'inputs' | 'outputs'>,
    _context?: RemoteMutationContext
  ): boolean {
    const state = roots.get(graphScope.rootGraphId)?.byId.get(nodeId)
    if (!state || state.graphId !== graphScope.owningGraphId) return false
    replaceSlotsInPlace(state, slots)
    return true
  }

  function updateNode(
    graphScope: GraphScope,
    nodeId: NodeId,
    replacement: NodeState,
    _context?: RemoteMutationContext
  ): boolean {
    const state = roots.get(graphScope.rootGraphId)?.byId.get(nodeId)
    if (!state || state.graphId !== graphScope.owningGraphId) return false

    replaceSlotsInPlace(state, replacement)
    assignNodeFields(state, replacement)
    return true
  }

  /**
   * Replaces every scalar field of a node from `replacement` while leaving
   * its `inputs` and `outputs` arrays untouched. Used when the slot layout is
   * owned elsewhere (e.g. a live subgraph host whose promoted slots are bound
   * to widgets) and only title/mode/flags/properties/colors may change.
   */
  function updateNodeFields(
    graphScope: GraphScope,
    nodeId: NodeId,
    replacement: NodeState,
    _context?: RemoteMutationContext
  ): boolean {
    const state = roots.get(graphScope.rootGraphId)?.byId.get(nodeId)
    if (!state || state.graphId !== graphScope.owningGraphId) return false
    assignNodeFields(state, replacement)
    return true
  }

  /**
   * Refills `target` with `source`'s elements without changing `target`'s
   * identity. A spread into `splice`/`push` turns the element count into an
   * argument count and can throw `RangeError: Maximum call stack size
   * exceeded` for a pathologically long slot list; an index-by-index copy
   * has no such limit.
   */
  function refillArray<T>(target: T[], source: readonly T[]): void {
    const length = source.length
    for (let i = 0; i < length; i++) target[i] = source[i]
    target.length = length
  }

  /**
   * Refills the registered slot arrays in place so every holder of the live
   * array (a node's own `inputs`/`outputs`, a reactive view over them) keeps
   * the identity it was handed. Reassigning the properties instead would
   * strand those holders on the previous arrays.
   */
  function replaceSlotsInPlace(
    state: NodeState,
    slots: Pick<NodeState, 'inputs' | 'outputs'>
  ): void {
    refillArray(state.inputs, slots.inputs)
    refillArray(state.outputs, slots.outputs)
  }

  function assignNodeFields(state: NodeState, replacement: NodeState): void {
    const {
      graphId: _graphId,
      id: _id,
      inputs: _inputs,
      outputs: _outputs,
      ...next
    } = replacement
    Object.assign(state, {
      bgcolor: undefined,
      boxcolor: undefined,
      color: undefined,
      lastSerialization: undefined,
      resizable: undefined,
      shape: undefined,
      showAdvanced: undefined,
      titleMode: undefined,
      ...next
    } satisfies Omit<NodeState, 'graphId' | 'id' | 'inputs' | 'outputs'>)
  }

  function clearGraph(rootGraphId: UUID): void {
    roots.delete(toRootGraphId(rootGraphId))
  }

  function clearOwner(
    graphScope: GraphScope,
    _context?: RemoteMutationContext
  ): void {
    const bucket = roots.get(graphScope.rootGraphId)
    const ids = bucket?.idsByOwner.get(graphScope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) bucket.byId.delete(id)
    bucket.idsByOwner.delete(graphScope.owningGraphId)
    if (bucket.byId.size === 0) roots.delete(graphScope.rootGraphId)
  }

  return {
    clearOwner,
    clearGraph,
    deleteNode,
    getGraphNodesFor,
    getNode,
    ownsNode,
    registerNode,
    updateNode,
    updateNodeFields,
    updateNodeSlots
  }
})
