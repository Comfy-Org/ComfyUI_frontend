import type { Ref } from 'vue'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  IWidgetInputSlot
} from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'

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

export function findCompatibleTargets(
  context: SlotMenuContext,
  maxResults: number = 15
): CompatibleTarget[] {
  const graph = app.canvas?.graph
  if (!graph) return []

  const sourceNode = graph.getNodeById(context.nodeId)
  if (!sourceNode) return []

  const sourceSlot = context.isInput
    ? sourceNode.inputs?.[context.slotIndex]
    : sourceNode.outputs?.[context.slotIndex]
  if (!sourceSlot) return []

  if (isWildcardType(sourceSlot.type)) return []

  const results: CompatibleTarget[] = []

  for (const candidate of graph._nodes) {
    if (candidate.id === sourceNode.id) continue
    if (candidate.mode === LGraphEventMode.NEVER) continue

    if (context.isInput) {
      if (!candidate.outputs) continue
      for (let i = 0; i < candidate.outputs.length; i++) {
        const output = candidate.outputs[i]
        if (isWildcardType(output.type)) continue
        if (LiteGraph.isValidConnection(output.type, sourceSlot.type)) {
          results.push({ node: candidate, slotIndex: i, slotInfo: output })
        }
      }
    } else {
      if (!candidate.inputs) continue
      for (let i = 0; i < candidate.inputs.length; i++) {
        const input = candidate.inputs[i]
        if (input.link != null) continue
        if (isWildcardType(input.type)) continue
        if (LiteGraph.isValidConnection(sourceSlot.type, input.type)) {
          results.push({ node: candidate, slotIndex: i, slotInfo: input })
        }
      }
    }
  }

  results.sort((a, b) => a.node.pos[1] - b.node.pos[1])
  return results.slice(0, maxResults)
}

export function renameSlot(context: SlotMenuContext, newLabel: string): void {
  const graph = app.canvas?.graph
  if (!graph) return

  const node = graph.getNodeById(context.nodeId)
  if (!node) return

  const slotInfo = context.isInput
    ? node.getInputInfo(context.slotIndex)
    : node.getOutputInfo(context.slotIndex)
  if (!slotInfo) return

  graph.beforeChange()
  slotInfo.label = newLabel
  app.canvas?.setDirty(true, true)
  graph.afterChange()
}

export function canRenameSlot(context: SlotMenuContext): boolean {
  const graph = app.canvas?.graph
  if (!graph) return false

  const node = graph.getNodeById(context.nodeId)
  if (!node) return false

  const slotInfo = context.isInput
    ? node.inputs?.[context.slotIndex]
    : node.outputs?.[context.slotIndex]
  if (!slotInfo) return false

  if (slotInfo.nameLocked) return false
  if (
    context.isInput &&
    'link' in slotInfo &&
    (slotInfo as IWidgetInputSlot).widget
  )
    return false

  return true
}

export function connectSlots(
  context: SlotMenuContext,
  target: CompatibleTarget
): void {
  const graph = app.canvas?.graph
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
  app.canvas?.setDirty(true, true)
}

export type { SlotMenuContext }
