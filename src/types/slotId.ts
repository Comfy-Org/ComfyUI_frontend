import type { NodeId } from '@/types/nodeId'

export type SlotId = string & { readonly __brand: 'SlotId' }
export type SlotIndex = number
export type SlotDirection = 'input' | 'output'

export function slotId(
  nodeId: NodeId,
  direction: SlotDirection,
  index: SlotIndex
): SlotId {
  const type = direction === 'input' ? 'in' : 'out'
  return `${String(nodeId)}-${type}-${index}` as SlotId
}
