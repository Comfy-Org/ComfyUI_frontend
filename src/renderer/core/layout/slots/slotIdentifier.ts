import type { NodeId } from '@/types/nodeId'

/**
 * Slot identifier utilities for consistent slot key generation and parsing
 *
 * Provides a centralized interface for slot identification across the layout system
 *
 * @TODO Replace this concatenated string with root cause fix
 */

interface SlotIdentifier {
  nodeId: NodeId
  index: number
  isInput: boolean
}

/**
 * Generate a unique key for a slot
 * Format: "{nodeId}-{in|out}-{index}"
 */
export function getSlotKey(identifier: SlotIdentifier): string
export function getSlotKey(
  nodeId: NodeId,
  index: number,
  isInput: boolean
): string
export function getSlotKey(
  nodeIdOrIdentifier: NodeId | SlotIdentifier,
  index?: number,
  isInput?: boolean
): string {
  if (typeof nodeIdOrIdentifier === 'object') {
    const { nodeId, index, isInput } = nodeIdOrIdentifier
    return `${String(nodeId)}-${isInput ? 'in' : 'out'}-${index}`
  }

  if (index === undefined || isInput === undefined) {
    throw new Error('Missing required parameters for slot key generation')
  }

  return `${String(nodeIdOrIdentifier)}-${isInput ? 'in' : 'out'}-${index}`
}
