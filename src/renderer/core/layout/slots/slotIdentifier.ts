import { slotId } from '@comfyorg/graph-model/slotId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { SlotId, SlotIndex } from '@comfyorg/graph-model/slotId'

export function getSlotKey(
  nodeId: NodeId,
  index: SlotIndex,
  isInput: boolean
): SlotId {
  return slotId(nodeId, isInput ? 'input' : 'output', index)
}
