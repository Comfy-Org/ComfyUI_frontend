import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot, ISlotType } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createNode, isLGraphNode } from '@/utils/litegraphUtil'

export interface FanSource {
  node: LGraphNode
  outputIndex: number
}

export interface FanInput {
  node: LGraphNode
  inputIndex: number
}

const BATCH_IMAGES_NODE = 'BatchImagesNode'
const BATCH_NODE_GAP_X = 100

function findMatchingSlotIndex(
  slots: ReadonlyArray<{ type: ISlotType }> | undefined,
  preferredIndex: number,
  type: ISlotType
): number | undefined {
  const preferred = slots?.[preferredIndex]
  if (preferred && LiteGraph.isValidConnection(preferred.type, type))
    return preferredIndex

  const index = slots?.findIndex((slot) =>
    LiteGraph.isValidConnection(slot.type, type)
  )
  return index !== undefined && index >= 0 ? index : undefined
}

/**
 * Resolves which output on each selected node should fan out alongside the
 * grabbed slot. The grabbed source is always returned first; selected nodes
 * without a type-compatible output are skipped.
 */
export function collectFanOutputs(
  grabbedNode: LGraphNode,
  grabbedOutputIndex: number,
  selectedNodes: LGraphNode[]
): FanSource[] {
  const grabbedOutput = grabbedNode.outputs?.[grabbedOutputIndex]
  if (!grabbedOutput) return []

  const grabbedType = grabbedOutput.type
  const sources: FanSource[] = [
    { node: grabbedNode, outputIndex: grabbedOutputIndex }
  ]

  for (const node of selectedNodes) {
    if (node === grabbedNode) continue
    const outputIndex = findMatchingSlotIndex(
      node.outputs,
      grabbedOutputIndex,
      grabbedType
    )
    if (outputIndex !== undefined) sources.push({ node, outputIndex })
  }

  return sources
}

/**
 * Resolves which input on each selected node should fan out alongside the
 * grabbed input. The grabbed source is always returned first; selected nodes
 * without a type-compatible input are skipped.
 */
export function collectFanInputs(
  grabbedNode: LGraphNode,
  grabbedInputIndex: number,
  selectedNodes: LGraphNode[]
): FanInput[] {
  const grabbedInput = grabbedNode.inputs?.[grabbedInputIndex]
  if (!grabbedInput) return []

  const grabbedType = grabbedInput.type
  const sources: FanInput[] = [
    { node: grabbedNode, inputIndex: grabbedInputIndex }
  ]

  for (const node of selectedNodes) {
    if (node === grabbedNode) continue
    const inputIndex = findMatchingSlotIndex(
      node.inputs,
      grabbedInputIndex,
      grabbedType
    )
    if (inputIndex !== undefined) sources.push({ node, inputIndex })
  }

  return sources
}

/**
 * Narrows dragged render-link candidates to concrete node sources, dropping
 * any whose origin is not an LGraphNode (e.g. subgraph IO nodes).
 */
export function toImageBatchSources(
  candidates: ReadonlyArray<{ node: unknown; fromSlotIndex: number }>
): FanSource[] {
  const sources: FanSource[] = []
  for (const candidate of candidates) {
    if (isLGraphNode(candidate.node)) {
      sources.push({
        node: candidate.node,
        outputIndex: candidate.fromSlotIndex
      })
    }
  }
  return sources
}

function positionRightOfNodes(nodes: LGraphNode[]): [number, number] {
  const rightEdge = Math.max(...nodes.map((node) => node.pos[0] + node.size[0]))
  const top = Math.min(...nodes.map((node) => node.pos[1]))
  return [rightEdge + BATCH_NODE_GAP_X, top]
}

/**
 * The autogrow group an input belongs to, if its node grows that group's slots
 * on connection (e.g. Batch Images, partner nodes like Nano Banana 2).
 */
function autogrowGroupName(
  node: LGraphNode,
  input: INodeInputSlot
): string | undefined {
  const autogrow = node.comfyDynamic?.autogrow
  if (!autogrow) return undefined

  const lastDot = input.name.lastIndexOf('.')
  if (lastDot === -1) return undefined

  const groupName = input.name.slice(0, lastDot)
  return groupName in autogrow ? groupName : undefined
}

function firstFreeGroupInputIndex(
  node: LGraphNode,
  groupName: string
): number | undefined {
  const index = node.inputs.findIndex(
    (input) => input.name.startsWith(`${groupName}.`) && input.link == null
  )
  return index >= 0 ? index : undefined
}

/**
 * When the target input belongs to a dynamic (autogrow) group, connect every
 * source directly into successive group slots — the node grows to fit — instead
 * of inserting a batch node. Returns `true` when it handled the connection.
 */
export function connectImagesToDynamicInput(
  targetNode: LGraphNode,
  inputSlot: INodeInputSlot,
  sources: FanSource[]
): boolean {
  const groupName = autogrowGroupName(targetNode, inputSlot)
  if (groupName === undefined) return false

  let connected = false
  for (const source of sources) {
    const slotIndex = firstFreeGroupInputIndex(targetNode, groupName)
    if (slotIndex === undefined) break
    const link = source.node.connect(source.outputIndex, targetNode, slotIndex)
    if (link) connected = true
  }
  return connected
}

/**
 * Creates a `BatchImagesNode` to the right of the source nodes, wires every fan
 * source output into it, and connects its output to the target input —
 * mirroring the filesystem multi-image drop. Returns the created node, or
 * `null` if creation failed.
 */
export async function createBatchImagesNode(
  canvas: LGraphCanvas,
  sources: FanSource[],
  targetNode: LGraphNode,
  targetInputIndex: number
): Promise<LGraphNode | null> {
  const batchNode = await createNode(canvas, BATCH_IMAGES_NODE)
  if (!batchNode) return null

  batchNode.pos = positionRightOfNodes(sources.map((source) => source.node))

  let allConnected = true
  sources.forEach((source, index) => {
    const link = source.node.connect(source.outputIndex, batchNode, index)
    if (!link) allConnected = false
  })
  const targetLink = batchNode.connect(0, targetNode, targetInputIndex)
  if (!targetLink) allConnected = false

  if (!allConnected) {
    console.warn('Some batch image connections could not be wired')
  }

  canvas.setDirty(true, true)
  return batchNode
}

/**
 * Handles the connect-after-search step for a multi-node image fan-out dropped
 * on empty canvas: routes every dragged image output through an auto-created
 * BatchImagesNode into the chosen node's image input. Returns `true` when it
 * handled the connection so the caller can skip the default single connect.
 */
export function connectImageBatchToCreatedNode(
  canvas: LGraphCanvas,
  createdNode: LGraphNode
): boolean {
  const { renderLinks, state } = canvas.linkConnector
  if (state.connectingTo !== 'input' || renderLinks.length <= 1) return false

  const fromSlot = renderLinks[0]?.fromSlot
  if (!fromSlot || fromSlot.type !== 'IMAGE') return false

  const target = createdNode.findInputByType(fromSlot.type)
  if (!target || target.slot.type !== 'IMAGE') return false

  const sources = toImageBatchSources(renderLinks)
  if (sources.length <= 1) return false

  if (connectImagesToDynamicInput(createdNode, target.slot, sources))
    return true

  void createBatchImagesNode(canvas, sources, createdNode, target.index).catch(
    (error) => {
      console.error('Failed to create batch images node', error)
    }
  )
  return true
}
