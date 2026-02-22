import type { Ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'

interface SlotMenuContext {
  nodeId: NodeId
  slotIndex: number
  isInput: boolean
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
  if (context.isInput && 'widget' in slotInfo && slotInfo.widget) return false

  return true
}

export type { SlotMenuContext }
