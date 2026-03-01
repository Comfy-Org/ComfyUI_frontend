import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinkId, LLink } from '@/lib/litegraph/src/LLink'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { SubgraphIO } from '@/lib/litegraph/src/types/serialisation'

type SlotConnection = INodeInputSlot | INodeOutputSlot | SubgraphIO

function dispatchSlotLinkChanged(params: {
  graph: LGraph
  nodeId: NodeId
  slotType: NodeSlotType
  slotIndex: number
  connected: boolean
  linkId: LinkId
  hasWidget: boolean
}): void {
  const { graph, nodeId, slotType, slotIndex, connected, linkId, hasWidget } =
    params
  if (!hasWidget) return

  graph.trigger('node:slot-links:changed', {
    nodeId,
    slotType,
    slotIndex,
    connected,
    linkId
  })
}

function dispatchNodeConnectionChange(params: {
  node: LGraphNode | undefined
  slotType: NodeSlotType
  slotIndex: number
  connected: boolean
  link: LLink | undefined
  slot: SlotConnection
}): void {
  const { node, slotType, slotIndex, connected, link, slot } = params
  node?.onConnectionsChange?.(slotType, slotIndex, connected, link, slot)
}

// Dispatch ordering: connect fires OUTPUT→INPUT; disconnect fires INPUT→OUTPUT
// (LIFO-style teardown). disconnect accepts SubgraphIO as targetSlot because
// subgraph output nodes act as inputs inside the subgraph and are passed
// directly from the disconnect callsite.
function dispatchConnectNodePair(params: {
  sourceNode: LGraphNode
  sourceSlotIndex: number
  sourceSlot: INodeOutputSlot
  targetNode: LGraphNode
  targetSlotIndex: number
  targetSlot: INodeInputSlot
  link: LLink
}): void {
  const {
    sourceNode,
    sourceSlotIndex,
    sourceSlot,
    targetNode,
    targetSlotIndex,
    targetSlot,
    link
  } = params

  dispatchNodeConnectionChange({
    node: sourceNode,
    slotType: NodeSlotType.OUTPUT,
    slotIndex: sourceSlotIndex,
    connected: true,
    link,
    slot: sourceSlot
  })
  dispatchNodeConnectionChange({
    node: targetNode,
    slotType: NodeSlotType.INPUT,
    slotIndex: targetSlotIndex,
    connected: true,
    link,
    slot: targetSlot
  })
}

function dispatchDisconnectNodePair(params: {
  sourceNode: LGraphNode
  sourceSlotIndex: number
  sourceSlot: INodeOutputSlot
  targetNode: LGraphNode
  targetSlotIndex: number
  targetSlot: INodeInputSlot | SubgraphIO
  link: LLink
}): void {
  const {
    sourceNode,
    sourceSlotIndex,
    sourceSlot,
    targetNode,
    targetSlotIndex,
    targetSlot,
    link
  } = params

  dispatchNodeConnectionChange({
    node: targetNode,
    slotType: NodeSlotType.INPUT,
    slotIndex: targetSlotIndex,
    connected: false,
    link,
    slot: targetSlot
  })
  dispatchNodeConnectionChange({
    node: sourceNode,
    slotType: NodeSlotType.OUTPUT,
    slotIndex: sourceSlotIndex,
    connected: false,
    link,
    slot: sourceSlot
  })
}

export const graphLifecycleEventDispatcher = {
  dispatchSlotLinkChanged,
  dispatchNodeConnectionChange,
  dispatchConnectNodePair,
  dispatchDisconnectNodePair
}
