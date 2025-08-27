/**
 * Slot identifier utilities for consistent slot key generation and parsing
 *
 * Provides a centralized interface for slot identification across the layout system
 *
 * @TODO Replace this concatenated string with root cause fix
 */

export interface SlotIdentifier {
  nodeId: string
  index: number
  isInput: boolean
}

/**
 * Generate a unique key for a slot
 * Format: "{nodeId}-{in|out}-{index}"
 */
export function getSlotKey(identifier: SlotIdentifier): string
export function getSlotKey(
  nodeId: string,
  index: number,
  isInput: boolean
): string
export function getSlotKey(
  nodeIdOrIdentifier: string | SlotIdentifier,
  index?: number,
  isInput?: boolean
): string {
  if (typeof nodeIdOrIdentifier === 'object') {
    const { nodeId, index, isInput } = nodeIdOrIdentifier
    return `${nodeId}-${isInput ? 'in' : 'out'}-${index}`
  }

  if (index === undefined || isInput === undefined) {
    throw new Error('Missing required parameters for slot key generation')
  }

  return `${nodeIdOrIdentifier}-${isInput ? 'in' : 'out'}-${index}`
}

/**
 * Parse a slot key back into its components
 */
export function parseSlotKey(key: string): SlotIdentifier | null {
  const match = key.match(/^(.+)-(in|out)-(\d+)$/)
  if (!match) return null

  return {
    nodeId: match[1],
    isInput: match[2] === 'in',
    index: parseInt(match[3], 10)
  }
}

/**
 * Check if a key represents an input slot
 */
export function isInputSlotKey(key: string): boolean {
  return key.includes('-in-')
}

/**
 * Check if a key represents an output slot
 */
export function isOutputSlotKey(key: string): boolean {
  return key.includes('-out-')
}

/**
 * Get the node ID from a slot key
 */
export function getNodeIdFromSlotKey(key: string): string | null {
  const parsed = parseSlotKey(key)
  return parsed?.nodeId ?? null
}
