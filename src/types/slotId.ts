import type { NodeId } from '@/types/nodeId'

export type SlotId = string & { readonly __brand: 'SlotId' }
export type SlotIndex = number
export type SlotDirection = 'input' | 'output'

const SEPARATOR = ':'

export function slotId(
  nodeId: NodeId,
  index: SlotIndex,
  direction: SlotDirection
): SlotId {
  return [
    encodeURIComponent(String(nodeId)),
    encodeURIComponent(direction),
    encodeURIComponent(String(index))
  ].join(SEPARATOR) as SlotId
}
