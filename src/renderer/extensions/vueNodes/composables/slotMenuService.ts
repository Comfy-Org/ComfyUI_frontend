import type { Ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'

export interface SlotMenuContext {
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

function getSlotInfo(context: SlotMenuContext) {
  const graph = app.canvas?.graph
  if (!graph) return null

  const node = graph.getNodeById(context.nodeId)
  if (!node) return null

  const slotInfo = context.isInput
    ? node.inputs?.[context.slotIndex]
    : node.outputs?.[context.slotIndex]
  if (!slotInfo) return null

  return { graph, node, slotInfo }
}

export function canRenameSlot(context: SlotMenuContext): boolean {
  const result = getSlotInfo(context)
  if (!result) return false

  const { slotInfo } = result
  if (slotInfo.nameLocked) return false
  if (context.isInput && 'widget' in slotInfo && slotInfo.widget) return false

  return true
}

export function canDisconnectSlot(context: SlotMenuContext): boolean {
  const result = getSlotInfo(context)
  if (!result) return false

  const { slotInfo } = result
  if (context.isInput) {
    return 'link' in slotInfo && slotInfo.link != null
  }
  return (
    'links' in slotInfo &&
    Array.isArray(slotInfo.links) &&
    slotInfo.links.length > 0
  )
}

export function canRemoveSlot(context: SlotMenuContext): boolean {
  const result = getSlotInfo(context)
  if (!result) return false

  const { slotInfo } = result
  return Boolean(slotInfo.removable) && !slotInfo.locked
}

export function hasAnySlotAction(context: SlotMenuContext): boolean {
  return (
    canRenameSlot(context) ||
    canDisconnectSlot(context) ||
    canRemoveSlot(context)
  )
}

function triggerSlotRefresh(context: SlotMenuContext): void {
  const graph = app.canvas?.graph
  graph?.trigger('node:slot-label:changed', {
    nodeId: context.nodeId
  })
}

export function renameSlot(context: SlotMenuContext, newLabel: string): void {
  if (!canRenameSlot(context)) return

  const result = getSlotInfo(context)
  if (!result) return

  const { graph, slotInfo } = result

  graph.beforeChange()
  slotInfo.label = newLabel
  app.canvas?.setDirty(true, true)
  graph.afterChange()
}

export function disconnectSlotLinks(context: SlotMenuContext): void {
  if (!canDisconnectSlot(context)) return

  const result = getSlotInfo(context)
  if (!result) return

  const { graph, node } = result

  graph.beforeChange()
  if (context.isInput) {
    node.disconnectInput(context.slotIndex, true)
  } else {
    node.disconnectOutput(context.slotIndex)
  }
  graph.afterChange()
  app.canvas?.setDirty(true, true)
  triggerSlotRefresh(context)
}

export function removeSlot(context: SlotMenuContext): void {
  if (!canRemoveSlot(context)) return

  const result = getSlotInfo(context)
  if (!result) return

  const { graph, node } = result

  graph.beforeChange()
  if (context.isInput) {
    node.removeInput(context.slotIndex)
  } else {
    node.removeOutput(context.slotIndex)
  }
  graph.afterChange()
  app.canvas?.setDirty(true, true)
  triggerSlotRefresh(context)
}
