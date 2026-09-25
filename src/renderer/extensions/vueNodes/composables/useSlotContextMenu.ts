import type { Ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

interface SlotMenuContext {
  nodeId: NodeId
  slotIndex: number
  isInput: boolean
}

interface CompatibleTarget {
  node: LGraphNode
  slotIndex: number
  slotInfo: INodeInputSlot | INodeOutputSlot
}

interface SlotMenuInstance {
  show: (event: MouseEvent, context: SlotMenuContext) => void
  hide: () => void
  isOpen: Ref<boolean>
}

let slotMenuInstance: SlotMenuInstance | null = null

export function registerSlotMenuInstance(
  instance: SlotMenuInstance | null
): void {
  slotMenuInstance = instance
}

export function showSlotMenu(
  event: MouseEvent,
  context: SlotMenuContext
): void {
  slotMenuInstance?.show(event, context)
}

function isWildcardType(type: unknown): boolean {
  return type === '*' || type === '' || type === 0
}

function findOutputTargets(
  graph: LGraph,
  sourceNode: LGraphNode,
  sourceSlot: INodeInputSlot
): CompatibleTarget[] {
  return graph._nodes.flatMap((candidate) => {
    if (
      candidate.id === sourceNode.id ||
      candidate.mode === LGraphEventMode.NEVER
    )
      return []

    return candidate.outputs.flatMap((output, slotIndex) =>
      !isWildcardType(output.type) &&
      LiteGraph.isValidConnection(output.type, sourceSlot.type)
        ? [{ node: candidate, slotIndex, slotInfo: output }]
        : []
    )
  })
}

function findInputTargets(
  graph: LGraph,
  sourceNode: LGraphNode,
  sourceSlot: INodeOutputSlot
): CompatibleTarget[] {
  return graph._nodes.flatMap((candidate) => {
    if (
      candidate.id === sourceNode.id ||
      candidate.mode === LGraphEventMode.NEVER
    )
      return []

    return candidate.inputs.flatMap((input, slotIndex) =>
      input.link == null &&
      !isWildcardType(input.type) &&
      LiteGraph.isValidConnection(sourceSlot.type, input.type)
        ? [{ node: candidate, slotIndex, slotInfo: input }]
        : []
    )
  })
}

export function findCompatibleTargets(
  context: SlotMenuContext,
  maxResults: number = 15
): CompatibleTarget[] {
  const graph = app.canvas.graph
  if (!graph) return []

  const sourceNode = graph.getNodeById(context.nodeId)
  if (!sourceNode) return []

  const sourceSlot = context.isInput
    ? sourceNode.inputs.at(context.slotIndex)
    : sourceNode.outputs.at(context.slotIndex)
  if (!sourceSlot) return []

  if (isWildcardType(sourceSlot.type)) return []

  const results = context.isInput
    ? findOutputTargets(graph, sourceNode, sourceSlot)
    : findInputTargets(graph, sourceNode, sourceSlot)

  results.sort((a, b) => a.node.pos[1] - b.node.pos[1])
  return results.slice(0, maxResults)
}

export function renameSlot(context: SlotMenuContext, newLabel: string): void {
  const graph = app.canvas.graph
  if (!graph) return

  const node = graph.getNodeById(context.nodeId)
  if (!node) return

  const slotInfo = context.isInput
    ? node.getInputInfo(context.slotIndex)
    : node.getOutputInfo(context.slotIndex)
  if (!slotInfo) return

  const normalizedLabel = newLabel.trim()
  if (!normalizedLabel || normalizedLabel === slotInfo.label) return

  graph.beforeChange()
  slotInfo.label = normalizedLabel
  app.canvas.setDirty(true, true)
  graph.afterChange()
}

export function canRenameSlot(context: SlotMenuContext): boolean {
  const graph = app.canvas.graph
  if (!graph) return false

  const node = graph.getNodeById(context.nodeId)
  if (!node) return false

  const slotInfo = context.isInput
    ? node.getInputInfo(context.slotIndex)
    : node.getOutputInfo(context.slotIndex)
  if (!slotInfo) return false

  if (slotInfo.nameLocked) return false
  if (context.isInput && 'widget' in slotInfo && slotInfo.widget) return false

  return true
}

export function connectSlots(
  context: SlotMenuContext,
  target: CompatibleTarget
): void {
  const graph = app.canvas.graph
  if (!graph) return

  const sourceNode = graph.getNodeById(context.nodeId)
  if (!sourceNode) return

  graph.beforeChange()

  if (context.isInput) {
    target.node.connect(target.slotIndex, sourceNode, context.slotIndex)
  } else {
    sourceNode.connect(context.slotIndex, target.node, target.slotIndex)
  }

  graph.afterChange()
  app.canvas.setDirty(true, true)
}

export type { CompatibleTarget, SlotMenuContext }
export type FindCompatibleTargets = typeof findCompatibleTargets
