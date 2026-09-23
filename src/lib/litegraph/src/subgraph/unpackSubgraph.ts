import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'
import { createUuidv4 } from '@/utils/uuid'

import type { INodeInputSlot, Point } from '../interfaces'
import type { LGraph } from '../LGraph'
import { LGraphNode } from '../LGraphNode'
import { LiteGraph } from '../litegraph'
import type { ISerialisedNode } from '../types/serialisation'

export type UnpackedTargetInput =
  | {
      kind: 'input'
      input: INodeInputSlot
      subgraphInputId?: UUID
    }
  | {
      kind: 'subgraph'
      id: UUID
    }
  | { kind: 'unresolved' }

function inputSlotMarker(
  input: Pick<INodeInputSlot, 'name' | 'type'>,
  markerProperty: string
) {
  const marker: unknown = Object.getOwnPropertyDescriptor(
    input,
    markerProperty
  )?.value
  return typeof marker === 'number' ? marker : undefined
}

function recoveredInputSlotMarker(
  input: Pick<INodeInputSlot, 'name' | 'type'>,
  index: number,
  sourceInputs: Pick<INodeInputSlot, 'name' | 'type'>[],
  markerProperty: string,
  claimed: Set<number>
) {
  const candidates = sourceInputs
    .map((source, sourceIndex) => ({ source, sourceIndex }))
    .filter(
      ({ source }) => source.name === input.name && source.type === input.type
    )
    .filter(({ source }) => {
      const marker = inputSlotMarker(source, markerProperty)
      return marker !== undefined && !claimed.has(marker)
    })
  const match =
    candidates.length === 1
      ? candidates[0]
      : candidates.find(({ sourceIndex }) => sourceIndex === index)
  return match ? inputSlotMarker(match.source, markerProperty) : undefined
}

function inputSlotMarkers(
  inputs: Pick<INodeInputSlot, 'name' | 'type'>[],
  sourceInputs: Pick<INodeInputSlot, 'name' | 'type'>[],
  markerProperty: string
) {
  const markers = new Map<number, number>()
  const claimed = new Set<number>()

  for (const [index, input] of inputs.entries()) {
    const marker = inputSlotMarker(input, markerProperty)
    if (marker === undefined) continue
    markers.set(index, marker)
    claimed.add(marker)
  }

  for (const [index, input] of inputs.entries()) {
    if (markers.has(index)) continue
    const marker = recoveredInputSlotMarker(
      input,
      index,
      sourceInputs,
      markerProperty,
      claimed
    )
    if (marker === undefined) continue
    markers.set(index, marker)
    claimed.add(marker)
  }

  return markers
}

function cloneNodesForUnpack(
  nodes: Iterable<LGraphNode>,
  markerProperty: string
): ISerialisedNode[] {
  const clonedNodes: ISerialisedNode[] = []

  for (const node of nodes) {
    const nodeInfo = structuredClone(node.serialize())
    for (const [index, input] of (nodeInfo.inputs ?? []).entries()) {
      Object.defineProperty(input, markerProperty, {
        value: index,
        enumerable: true
      })
    }

    const clonedNode = LiteGraph.createNode(node.type)
    if (!clonedNode) {
      console.warn('Failed to create node', node.type)
      clonedNodes.push(nodeInfo)
      continue
    }

    clonedNode.configure(nodeInfo)
    const serializedNode = clonedNode.serialize()
    const markers = inputSlotMarkers(
      clonedNode.inputs,
      nodeInfo.inputs ?? [],
      markerProperty
    )
    for (const [index, marker] of markers) {
      const input = serializedNode.inputs?.[index]
      if (!input) continue
      Object.defineProperty(input, markerProperty, {
        value: marker,
        enumerable: true
      })
    }
    clonedNodes.push(serializedNode)
  }

  return clonedNodes
}

function createNodeForUnpack(nodeInfo: ISerialisedNode) {
  const node = LiteGraph.createNode(nodeInfo.type, nodeInfo.title)
  if (node) return node
  console.warn(
    `Cannot unpack node of type "${nodeInfo.type}" - node creation failed. Creating placeholder node.`
  )
  const placeholder = new LGraphNode(
    nodeInfo.title || nodeInfo.type || 'Missing Node',
    nodeInfo.type
  )
  placeholder.last_serialization = nodeInfo
  placeholder.has_errors = true
  return placeholder
}

export function findUnavailableSubgraphNodeType(
  nodes: Iterable<LGraphNode>
): string | undefined {
  for (const node of nodes) {
    if (!Object.hasOwn(LiteGraph.registered_node_types, node.type)) {
      return node.type
    }
  }
}

function stripSerializedLinks(nodeInfo: ISerialisedNode) {
  for (const input of nodeInfo.inputs ?? []) input.link = null
  for (const output of nodeInfo.outputs ?? []) output.links = []
}

function configuredInputSlots(
  node: LGraphNode,
  nodeInfo: ISerialisedNode,
  markerProperty: string
) {
  const configuredSlots = new Map<number, INodeInputSlot>()
  const markers = inputSlotMarkers(
    node.inputs,
    nodeInfo.inputs ?? [],
    markerProperty
  )
  for (const [index, input] of node.inputs.entries()) {
    Reflect.deleteProperty(input, markerProperty)
    const marker = markers.get(index)
    if (marker !== undefined) configuredSlots.set(marker, input)
  }
  for (const input of nodeInfo.inputs ?? []) {
    Reflect.deleteProperty(input, markerProperty)
  }
  return configuredSlots
}

export function materializeSubgraphNodes({
  graph,
  nodes,
  offset
}: {
  graph: LGraph
  nodes: Iterable<LGraphNode>
  offset: Point
}) {
  const inputSlotMarker = `__unpackInputSlot_${createUuidv4()}`
  const nodeInfos = cloneNodesForUnpack(nodes, inputSlotMarker)
  const nodeIdMap = new Map<NodeId, NodeId>()
  const inputSlots = new Map<NodeId, Map<number, INodeInputSlot>>()
  const materializedNodes: LGraphNode[] = []

  for (const nodeInfo of nodeInfos) {
    const node = createNodeForUnpack(nodeInfo)
    const oldNodeId = toNodeId(nodeInfo.id)

    // Strip links before configure so callbacks cannot resolve subgraph link
    // IDs against unrelated links in the parent graph.
    stripSerializedLinks(nodeInfo)

    // `node.id` starts UNASSIGNED (as freshly constructed), so this `add`
    // takes `LGraph.add`'s own unassigned-id path — the same graph-aware
    // disjoint-mode selection a directly-added node gets — instead of this
    // call preassigning a plain sequential id itself and only observing it
    // into `graph.add`. Preassigning would both bypass that selection (so
    // unpacking into a doc-bound root could mint inside the agent's
    // reserved range) and, for a disjoint mint, spuriously advance
    // `graph.state.lastNodeId` to the minted value through the
    // already-assigned-id `observe` path `graph.add` falls back to —
    // something a fresh disjoint mint must never do (see `LGraph.test.ts`'s
    // "never advancing lastNodeId" case).
    graph.add(node, true)
    const newNodeId = node.id
    nodeIdMap.set(oldNodeId, newNodeId)
    nodeInfo.id = newNodeId

    node.configure(nodeInfo)

    inputSlots.set(
      newNodeId,
      configuredInputSlots(node, nodeInfo, inputSlotMarker)
    )

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
  if (input) return { kind: 'input', input, subgraphInputId: id }
  return id ? { kind: 'subgraph', id } : { kind: 'unresolved' }
}

export function resolveUnpackedTargetInput(
  targetNode: LGraphNode,
  targetInput: UnpackedTargetInput | undefined,
  fallbackSlot: number
) {
  if (!targetInput) return fallbackSlot
  if (targetInput.kind === 'unresolved') return -1
  if (targetInput.kind === 'input') {
    const index = targetNode.inputs.indexOf(targetInput.input)
    if (index !== -1) return index
    if (!targetInput.subgraphInputId) return -1
  }
  const id =
    targetInput.kind === 'subgraph'
      ? targetInput.id
      : targetInput.subgraphInputId
  return targetNode.isSubgraphNode()
    ? targetNode.inputs.findIndex((input) => input._subgraphSlot?.id === id)
    : -1
}
