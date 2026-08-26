import { shallowReactive } from 'vue'

import { assert } from '@/base/assert'
import {
  canTransferLayoutAttachment,
  transferLayoutAttachment
} from '@/renderer/core/layout/operations/graphLayoutAttachment'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { zeroUuid } from '@/utils/uuid'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import type { NodeState } from '@/types/nodeState'

/**
 * Builds the shell state a node carries from construction until it adopts the
 * {@link useNodeDataStore} proxy in {@link registerNodeState}.
 */
export function createNodeShellState(
  title: string,
  type: string | undefined,
  titleMode: TitleMode | undefined
): NodeState {
  return {
    flags: {},
    graphId: zeroUuid,
    id: UNASSIGNED_NODE_ID,
    inputs: shallowReactive<INodeInputSlot[]>([]),
    mode: LGraphEventMode.ALWAYS,
    outputs: shallowReactive<INodeOutputSlot[]>([]),
    properties: {},
    title: title || 'Unnamed',
    type: type ?? '',
    titleMode
  }
}

/** Writes a shell-state field, emitting `node:property:changed` on change. */
export function setTrackedNodeState<K extends keyof NodeState>(
  node: LGraphNode,
  property: K,
  value: NodeState[K]
): void {
  const oldValue = node._state[property]
  if (oldValue === value) return

  node._state[property] = value
  node.graph?.trigger('node:property:changed', {
    nodeId: node.id,
    property,
    oldValue,
    newValue: value
  })
}

/**
 * Registers a node's shell state into {@link useNodeDataStore} and adopts the
 * store's proxy as {@link LGraphNode._state}. Call wherever a node joins a
 * graph. Returns `false` on an id collision within the owning root graph —
 * the caller must mint a new id and retry.
 */
export function registerNodeState(
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  node: LGraphNode
): boolean {
  const graphScope = graphScopeOf(graph)
  const store = useNodeDataStore()
  const strandedScope =
    node._graphScope === undefined ||
    node._graphScope.rootGraphId === graphScope.rootGraphId
      ? undefined
      : node._graphScope

  if (strandedScope !== undefined) {
    store.deleteNode(strandedScope, node._state)
    node._graphScope = undefined
  }
  assert(
    strandedScope === undefined,
    `registerNodeState: node ${node.id} already registered under a different root graph (${strandedScope?.rootGraphId})`
  )

  node._state.graphId = graph.id
  const registered = store.registerNode(graphScope, node._state)
  if (!registered) return false
  node._state = registered
  node._graphScope = graphScope
  return true
}

/**
 * Removes a node's shell state from {@link useNodeDataStore} and detaches the
 * node. No-op for nodes that were never registered.
 * @param node The node to unregister
 */
export function unregisterNodeState(node: LGraphNode): void {
  if (!node._graphScope) return
  const deleted = useNodeDataStore().deleteNode(node._graphScope, node._state)
  node._graphScope = undefined
  assert(
    deleted,
    `unregisterNodeState: state for node ${node.id} not found in bucket (identity drift)`
  )
}

function canTransferNodeState(
  node: LGraphNode,
  replacement: LGraphNode
): boolean {
  return (
    node.id === replacement.id &&
    replacement._graphScope === undefined &&
    node._graphScope !== undefined &&
    useNodeDataStore().ownsNode(node._graphScope, node._state)
  )
}

function transferNodeState(node: LGraphNode, replacement: LGraphNode): void {
  const registeredState = node._state
  const detachedState = { ...registeredState }
  const { graphId: _graphId, id: _id, ...replacementState } = replacement._state
  Object.assign(registeredState, {
    bgcolor: undefined,
    boxcolor: undefined,
    color: undefined,
    lastSerialization: undefined,
    resizable: undefined,
    shape: undefined,
    showAdvanced: undefined,
    titleMode: undefined,
    ...replacementState
  } satisfies {
    [K in Exclude<keyof NodeState, 'graphId' | 'id'>]-?:
      | NodeState[K]
      | undefined
  })
  replacement._state = registeredState
  replacement._graphScope = node._graphScope
  node._state = detachedState
  node._graphScope = undefined
}

/**
 * Whether `replacement` may adopt `node`'s registered shell state and layout
 * attachment during an in-place node-type replacement.
 */
export function canTransferReplacementOwnership(
  node: LGraphNode,
  replacement: LGraphNode
): boolean {
  return (
    canTransferNodeState(node, replacement) &&
    canTransferLayoutAttachment(node, replacement)
  )
}

/**
 * Transfers `node`'s registered shell state and layout attachment to
 * `replacement`, detaching `node`. Returns `false` (no-op) when the transfer
 * preconditions no longer hold.
 */
export function transferReplacementOwnership(
  node: LGraphNode,
  replacement: LGraphNode
): boolean {
  if (!canTransferReplacementOwnership(node, replacement)) return false
  if (!transferLayoutAttachment(node, replacement)) return false
  transferNodeState(node, replacement)
  return true
}
