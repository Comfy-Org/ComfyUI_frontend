/**
 * Slot identifier utilities for consistent slot key generation and parsing
 *
 * Provides a centralized interface for slot identification across the layout system
 *
 * @TODO Replace this concatenated string with root cause fix
 */

/**
 * Generate a unique key for a slot
 * Format: "{nodeId}-{in|out}-{index}"
 */
export function getSlotKey(
  nodeId: string,
  index: number,
  isInput: boolean
): string {
  return `${nodeId}-${isInput ? 'in' : 'out'}-${index}`
}
