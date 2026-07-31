import { reactive, shallowReactive } from 'vue'

import { assert } from '@/base/assert'
import { useNodeDataStore } from '@/stores/nodeDataStore'
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
 * store's proxy as {@link LGraphNode._state}. Call wherever a node joins a graph.
 */
export function registerNodeState(
  graph: Pick<LGraph, 'rootGraph' | 'id'>,
  node: LGraphNode
): void {
  const rootGraphId = graph.rootGraph.id
  assert(
    node._graphId === undefined || node._graphId === rootGraphId,
    `registerNodeState: node ${node.id} already registered under a different root graph`
  )
  node._state.graphId = graph.id
  node._state = reactive(node._state)
  useNodeDataStore().registerNode(rootGraphId, node._state)
  node._graphId = rootGraphId
}

/**
 * Removes a node's shell state from {@link useNodeDataStore} and detaches the
 * node. No-op for nodes that were never registered.
 * @param node The node to unregister
 */
export function unregisterNodeState(node: LGraphNode): void {
  if (!node._graphId) return
  const deleted = useNodeDataStore().deleteNode(node._graphId, node._state)
  node._graphId = undefined
  assert(
    deleted,
    `unregisterNodeState: state for node ${node.id} not found in bucket (identity drift)`
  )
}

/**
 * Unregisters every node a graph owns, including those inside the subgraph
 * definitions it holds. Used when a graph's nodes leave the store without a
 * whole-bucket wipe: subgraph-definition removal, and clearing a graph that
 * shares its bucket with other graphs.
 * @param graph The graph whose nodes should be unregistered
 */
export function unregisterAllNodeStates(
  graph: Pick<LGraph, '_nodes' | '_subgraphs'>
): void {
  for (const node of graph._nodes) unregisterNodeState(node)
  for (const subgraph of graph._subgraphs.values()) {
    unregisterAllNodeStates(subgraph)
  }
}
