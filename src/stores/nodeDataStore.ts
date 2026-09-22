import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, reactive, toRaw } from 'vue'
import * as Y from 'yjs'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot, NodeOutputSlot } from '@/lib/litegraph/src/litegraph'
import {
  definitionOwnerMaps,
  ownerNodesMap,
  semanticDocs
} from '@/stores/semanticDoc'
import type { LocalUpdateOrigin } from '@/stores/semanticDoc'
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

const SERIALISABLE_SLOT_FIELDS = [
  'name',
  'localized_name',
  'label',
  'type',
  'dir',
  'removable',
  'shape',
  'color_off',
  'color_on',
  'locked',
  'nameLocked',
  'pos'
] as const satisfies readonly (keyof INodeSlot)[]

function copyOwnFields<T extends object>(
  target: T,
  source: T,
  fields: readonly (keyof T)[]
): void {
  Object.assign(
    target,
    Object.fromEntries(
      fields.flatMap((field) =>
        Object.hasOwn(source, field) ? [[field, source[field]]] : []
      )
    )
  )
}

function patchInputSlot(
  target: INodeInputSlot,
  incoming: INodeInputSlot
): void {
  copyOwnFields(target, incoming, SERIALISABLE_SLOT_FIELDS)
  copyOwnFields(target, incoming, ['widget'])
  if (
    !(toRaw(target) instanceof NodeInputSlot) &&
    Object.hasOwn(incoming, 'link')
  ) {
    target.link = incoming.link
  }
}

function patchOutputSlot(
  target: INodeOutputSlot,
  incoming: INodeOutputSlot
): void {
  copyOwnFields(target, incoming, SERIALISABLE_SLOT_FIELDS)
  copyOwnFields(target, incoming, ['slot_index'])
  if (
    !(toRaw(target) instanceof NodeOutputSlot) &&
    Object.hasOwn(incoming, 'links')
  ) {
    target.links = incoming.links
  }
}

function copyInputSlot(incoming: INodeInputSlot): INodeInputSlot {
  const slot: INodeInputSlot = {
    name: incoming.name,
    type: incoming.type,
    boundingRect: incoming.boundingRect
  }
  patchInputSlot(slot, incoming)
  return slot
}

function copyOutputSlot(incoming: INodeOutputSlot): INodeOutputSlot {
  const slot: INodeOutputSlot = {
    name: incoming.name,
    type: incoming.type,
    boundingRect: incoming.boundingRect
  }
  patchOutputSlot(slot, incoming)
  return slot
}

function mergeSlotsByName<Slot extends { name: string }>(
  existing: Slot[],
  incoming: readonly Slot[],
  patch: (target: Slot, incoming: Slot) => void,
  copy: (incoming: Slot) => Slot
): void {
  const used = new Set<number>()
  const matches = incoming.map((incomingSlot) => {
    const index = existing.findIndex(
      (slot, candidate) =>
        !used.has(candidate) && slot.name === incomingSlot.name
    )
    if (index === -1) return undefined
    used.add(index)
    return { index, slot: existing[index] }
  })
  const insertions: number[] = []

  for (const [incomingIndex, incomingSlot] of incoming.entries()) {
    const match = matches[incomingIndex]
    if (match) {
      patch(match.slot, incomingSlot)
      continue
    }

    const anchor =
      matches.slice(incomingIndex + 1).find((candidate) => candidate)?.index ??
      existing.length - insertions.length
    const insertionIndex =
      anchor + insertions.filter((prior) => prior <= anchor).length
    existing.splice(insertionIndex, 0, copy(incomingSlot))
    insertions.push(anchor)
  }
}

const NODE_TYPE_KEY = 'type'

function localOrigin(context?: RemoteMutationContext): LocalUpdateOrigin {
  return context
    ? { source: 'local', actor: context.actor, opId: context.opId }
    : { source: 'local' }
}

/** The root graph acting as the owner of its own top-level nodes. */
function rootOwner(rootGraphId: RootGraphId): OwningGraphId {
  return toOwningGraphId(rootGraphId)
}

/**
 * One {@link NodeState} per node in a root-flat, owner-indexed bucket.
 * See docs/architecture/node-data-store.md.
 *
 * Node membership and ownership are projected from the root graph's semantic
 * Yjs document (`semanticDocs`): `idsByOwner` is derived by observing the
 * `nodes` root and every `definitions.<owner>.nodes` map, and local
 * registration/deletion writes those keys under a local origin. `byId` stays
 * the store-local materialisation of the live `NodeState` objects, because
 * litegraph writes slot and cosmetic fields to them directly.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  interface RootNodeBucket {
    byId: Map<NodeId, NodeState>
    idsByOwner: Map<OwningGraphId, Set<NodeId>>
  }

  const roots = reactive(new Map<RootGraphId, RootNodeBucket>())
  const unobserveByRoot = new Map<RootGraphId, () => void>()

  function addOwnerId(
    bucket: RootNodeBucket,
    owningGraphId: OwningGraphId,
    id: NodeId
  ): void {
    const ownerIds = bucket.idsByOwner.get(owningGraphId)
    if (ownerIds) ownerIds.add(id)
    else bucket.idsByOwner.set(owningGraphId, reactive(new Set([id])))
  }

  function removeOwnerId(
    bucket: RootNodeBucket,
    owningGraphId: OwningGraphId,
    id: NodeId
  ): void {
    const ownerIds = bucket.idsByOwner.get(owningGraphId)
    if (!ownerIds) return
    ownerIds.delete(id)
    if (ownerIds.size === 0) bucket.idsByOwner.delete(owningGraphId)
  }

  function observeRoot(rootGraphId: RootGraphId, bucket: RootNodeBucket): void {
    unobserveByRoot.set(
      rootGraphId,
      semanticDocs.projectMembership(rootGraphId, 'nodes', {
        add: (owningGraphId, id) =>
          addOwnerId(bucket, owningGraphId, id as NodeId),
        remove: (owningGraphId, id) =>
          removeOwnerId(bucket, owningGraphId, id as NodeId),
        resetDefinitionOwners: () => {
          for (const owningGraphId of [...bucket.idsByOwner.keys()]) {
            if ((owningGraphId as string) !== (rootGraphId as string))
              bucket.idsByOwner.delete(owningGraphId)
          }
        }
      })
    )
  }

  function dropRoot(rootGraphId: RootGraphId): void {
    unobserveByRoot.get(rootGraphId)?.()
    unobserveByRoot.delete(rootGraphId)
    roots.delete(rootGraphId)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const rootGraphId of [...unobserveByRoot.keys()])
        dropRoot(rootGraphId)
    })
  }

  function rootBucket(rootGraphId: RootGraphId): RootNodeBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootNodeBucket>({
      byId: new Map(),
      idsByOwner: new Map()
    })
    roots.set(rootGraphId, created)
    observeRoot(rootGraphId, created)
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
   *
   * Membership is written to the semantic document only when the owner's
   * `nodes` map lacks the key, so registering a state for a node that a merged
   * remote frame already placed in the document is a pure local materialisation.
   */
  function registerNode(
    graphScope: GraphScope,
    state: NodeState,
    context?: RemoteMutationContext
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
    semanticDocs.transactLocal(
      graphScope.rootGraphId,
      localOrigin(context),
      (doc) => {
        const nodes = ownerNodesMap(
          doc,
          graphScope.rootGraphId,
          graphScope.owningGraphId,
          true
        )
        if (nodes.has(registered.id)) return
        nodes.set(
          registered.id,
          new Y.Map<unknown>([[NODE_TYPE_KEY, registered.type]])
        )
      }
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
    context?: RemoteMutationContext
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
    semanticDocs.transactLocal(
      graphScope.rootGraphId,
      localOrigin(context),
      (doc) => {
        ownerNodesMap(
          doc,
          graphScope.rootGraphId,
          graphScope.owningGraphId,
          false
        )?.delete(state.id)
      }
    )
    if (bucket.byId.size === 0) dropRoot(graphScope.rootGraphId)
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
    mergeSlotsByName(state.inputs, slots.inputs, patchInputSlot, copyInputSlot)
    mergeSlotsByName(
      state.outputs,
      slots.outputs,
      patchOutputSlot,
      copyOutputSlot
    )
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

    state.inputs.splice(0, state.inputs.length, ...replacement.inputs)
    state.outputs.splice(0, state.outputs.length, ...replacement.outputs)
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

  /**
   * Drops every node of the root graph, clearing node membership from the
   * semantic document (root `nodes` and each definition's `nodes`) so a later
   * bucket for the same root does not re-seed stale ids.
   */
  function clearGraph(rootGraphId: UUID): void {
    const root = toRootGraphId(rootGraphId)
    if (!roots.has(root) && !semanticDocs.has(root)) return
    semanticDocs.transactLocal(root, localOrigin(), (doc) => {
      ownerNodesMap(doc, root, rootOwner(root), true).clear()
      for (const [, nodes] of definitionOwnerMaps(doc, 'nodes')) nodes.clear()
    })
    dropRoot(root)
  }

  function clearOwner(
    graphScope: GraphScope,
    context?: RemoteMutationContext
  ): void {
    const bucket = roots.get(graphScope.rootGraphId)
    const ids = bucket?.idsByOwner.get(graphScope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) bucket.byId.delete(id)
    semanticDocs.transactLocal(
      graphScope.rootGraphId,
      localOrigin(context),
      (doc) => {
        ownerNodesMap(
          doc,
          graphScope.rootGraphId,
          graphScope.owningGraphId,
          false
        )?.clear()
      }
    )
    bucket.idsByOwner.delete(graphScope.owningGraphId)
    if (bucket.byId.size === 0) dropRoot(graphScope.rootGraphId)
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
