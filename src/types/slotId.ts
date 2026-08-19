import type { NodeId } from '@/types/nodeId'

export type SlotId = string & { readonly __brand: 'SlotId' }
export type SlotIndex = number
export type SlotDirection = 'input' | 'output'

export function toSlotId(value: string): SlotId {
  return String(value) as SlotId
}

export function slotId(
  nodeId: NodeId,
  direction: SlotDirection,
  index: SlotIndex
): SlotId {
  const type = direction === 'input' ? 'in' : 'out'
  return toSlotId(`${String(nodeId)}-${type}-${index}`)
}
