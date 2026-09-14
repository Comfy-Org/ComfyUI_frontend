import type { UUID } from '@/utils/uuid'
import { createUuidv4 } from '@/utils/uuid'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import { mintNodeId } from '../idAllocation'
import type { INodeInputSlot, Point } from '../interfaces'
import type { LGraph } from '../LGraph'
import { LGraphNode } from '../LGraphNode'
import { LiteGraph } from '../litegraph'
import { multiClone } from './subgraphUtils'

export type UnpackedTargetInput =
  | {
      kind: 'subgraph'
      id: UUID
      input: INodeInputSlot | null
    }
  | {
      kind: 'node'
      input: INodeInputSlot | null
    }

export function materializeSubgraphNodes({
  graph,
  nodes,
  offset,
  skipMissingNodes
}: {
  graph: LGraph
  nodes: Iterable<LGraphNode>
  offset: Point
  skipMissingNodes: boolean
}) {
  const inputSlotMarker = `__unpackInputSlot_${createUuidv4()}`
  const nodeInfos = multiClone(nodes, inputSlotMarker)
  const nodeIdMap = new Map<NodeId, NodeId>()
  const inputSlots = new Map<NodeId, Map<number, INodeInputSlot>>()
  const materializedNodes: LGraphNode[] = []

  for (const nodeInfo of nodeInfos) {
    let node = LiteGraph.createNode(nodeInfo.type, nodeInfo.title)
    if (!node) {
      if (!skipMissingNodes) {
        throw Error(
          `Cannot unpack: node type "${nodeInfo.type}" is not registered`
        )
      }
      console.warn(
        `Cannot unpack node of type "${nodeInfo.type}" - node type not found. Creating placeholder node.`
      )
      node = new LGraphNode(
        nodeInfo.title || nodeInfo.type || 'Missing Node',
        nodeInfo.type
      )
      node.last_serialization = nodeInfo
      node.has_errors = true
    }

    const newNodeId = mintNodeId(graph.state)
    nodeIdMap.set(toNodeId(nodeInfo.id), newNodeId)
    node.id = newNodeId
    nodeInfo.id = newNodeId

    // Strip links before configure so callbacks cannot resolve subgraph link
    // IDs against unrelated links in the parent graph.
    for (const input of nodeInfo.inputs ?? []) input.link = null
    for (const output of nodeInfo.outputs ?? []) output.links = []

    graph.add(node, true)
    node.configure(nodeInfo)

    const configuredSlots = new Map<number, INodeInputSlot>()
    for (const input of node.inputs) {
      const marker: unknown = Object.getOwnPropertyDescriptor(
        input,
        inputSlotMarker
      )?.value
      Reflect.deleteProperty(input, inputSlotMarker)
      if (typeof marker === 'number') configuredSlots.set(marker, input)
    }
    for (const input of nodeInfo.inputs ?? []) {
      Reflect.deleteProperty(input, inputSlotMarker)
    }
    inputSlots.set(newNodeId, configuredSlots)

    node.setPos(node.pos[0] + offset[0], node.pos[1] + offset[1])
    materializedNodes.push(node)
  }

  return { nodeIdMap, inputSlots, materializedNodes }
}

export function captureUnpackedTargetInput(
  targetNode: LGraphNode | null | undefined,
  targetSlotIndex: number,
  input: INodeInputSlot | null = targetNode?.inputs[targetSlotIndex] ?? null
): UnpackedTargetInput | undefined {
  const targetSlot = targetNode?.inputs[targetSlotIndex]
  if (!targetNode || !targetSlot) return

  const id = targetNode.isSubgraphNode()
    ? targetNode.inputs[targetSlotIndex]?._subgraphSlot?.id
    : undefined
  return id ? { kind: 'subgraph', id, input } : { kind: 'node', input }
}

export function resolveUnpackedTargetInput(
  targetNode: LGraphNode,
  targetInput: UnpackedTargetInput | undefined,
  fallbackSlot: number
) {
  if (!targetInput) return fallbackSlot
  if (targetInput.input) {
    const index = targetNode.inputs.indexOf(targetInput.input)
    if (index !== -1) return index
  }
  if (targetInput.kind === 'subgraph') {
    return targetNode.isSubgraphNode()
      ? targetNode.inputs.findIndex(
          (input) => input._subgraphSlot?.id === targetInput.id
        )
      : -1
  }
  return -1
}
