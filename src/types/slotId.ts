import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

export type SlotId = string & { readonly __brand: 'SlotId' }
export type SlotIndex = number
export type SlotDirection = 'input' | 'output'

function toSlotId(value: string): SlotId {
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

export function parseSlotId(value: string): {
  key: SlotId
  nodeId: NodeId
  direction: SlotDirection
  index: SlotIndex
} | null {
  const match = /^(.*)-(in|out)-(\d+)$/.exec(value)
  if (!match?.[1] || !match[2] || !match[3]) return null
  const index = Number(match[3])
  if (!Number.isSafeInteger(index)) return null

  return {
    key: toSlotId(value),
    nodeId: toNodeId(match[1]),
    direction: match[2] === 'in' ? 'input' : 'output',
    index
  }
}
