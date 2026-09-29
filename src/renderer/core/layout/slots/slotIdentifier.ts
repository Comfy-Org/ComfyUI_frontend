import { slotId } from '@/types/slotId'
import type { NodeId } from '@/types/nodeId'
import type { SlotId, SlotIndex } from '@/types/slotId'

export function getSlotKey(
  nodeId: NodeId,
  index: SlotIndex,
  isInput: boolean
): SlotId {
  return slotId(nodeId, isInput ? 'input' : 'output', index)
}
