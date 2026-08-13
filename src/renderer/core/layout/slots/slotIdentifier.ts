import { slotId } from '@/types/slotId'
import type { NodeId } from '@/types/nodeId'
import type { SlotId, SlotIndex } from '@/types/slotId'

interface SlotIdentifier {
  nodeId: NodeId
  index: SlotIndex
  isInput: boolean
}

export function getSlotKey(identifier: SlotIdentifier): SlotId
export function getSlotKey(
  nodeId: NodeId,
  index: SlotIndex,
  isInput: boolean
): SlotId
export function getSlotKey(
  nodeIdOrIdentifier: NodeId | SlotIdentifier,
  index?: SlotIndex,
  isInput?: boolean
): SlotId {
  if (typeof nodeIdOrIdentifier === 'object') {
    const { nodeId, index, isInput } = nodeIdOrIdentifier
    return slotId(nodeId, isInput ? 'input' : 'output', index)
  }

  if (index === undefined || isInput === undefined) {
    throw new Error('Missing required parameters for slot key generation')
  }

  return slotId(nodeIdOrIdentifier, isInput ? 'input' : 'output', index)
}
