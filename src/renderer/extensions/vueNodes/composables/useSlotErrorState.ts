/**
 * @fileoverview Reactive state management for slot error indicators
 * @module composables/useSlotErrorState
 */
import { reactive, readonly } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/litegraph'

/**
 * Slot type indicators
 */
type SlotType = 'input' | 'output'

/**
 * Generates a consistent key for slot error state tracking
 * @param nodeId - The node identifier
 * @param slotIndex - The slot index
 * @param slotType - The slot type ('input' or 'output')
 * @returns Formatted key string
 */
function generateSlotKey(
  nodeId: NodeId,
  slotIndex: number,
  slotType: SlotType
): string {
  return `${String(nodeId)}-${slotType}-${slotIndex}`
}

/**
 * Global reactive state for slot error indicators
 * Provides Vue-reactive tracking for slot errors without making LiteGraph objects reactive
 */
const slotErrorState = reactive(new Map<string, boolean>())

/**
 * Maps nodeId to Set of slot keys for easy lookup
 */
const nodeToSlotsIndex = reactive(new Map<string, Set<string>>())

/**
 * Composable for managing slot error state reactively
 * Bridges LiteGraph object mutations with Vue reactivity
 */
export function useSlotErrorState() {
  /**
   * Set error state for a specific slot
   * @param nodeId - The node identifier (string or number from LiteGraph)
   * @param slotIndex - The slot index
   * @param slotType - The slot type ('input' or 'output')
   * @param hasError - Whether the slot has an error
   */
  function setSlotError(
    nodeId: NodeId,
    slotIndex: number,
    slotType: SlotType,
    hasError: boolean
  ) {
    const key = generateSlotKey(nodeId, slotIndex, slotType)
    const nodeIdStr = String(nodeId)

    if (!hasError) {
      slotErrorState.delete(key)
      const nodeSlots = nodeToSlotsIndex.get(nodeIdStr)
      if (!nodeSlots) return

      nodeSlots.delete(key)
      if (nodeSlots.size === 0) {
        nodeToSlotsIndex.delete(nodeIdStr)
      }
      return
    }

    slotErrorState.set(key, true)
    if (!nodeToSlotsIndex.has(nodeIdStr)) {
      nodeToSlotsIndex.set(nodeIdStr, new Set())
    }
    nodeToSlotsIndex.get(nodeIdStr)!.add(key)
  }

  /**
   * Check if a specific slot has an error
   * @param nodeId - The node identifier (string or number from LiteGraph)
   * @param slotIndex - The slot index
   * @param slotType - The slot type ('input' or 'output')
   * @returns True if the slot has an error
   */
  function hasSlotError(
    nodeId: NodeId,
    slotIndex: number,
    slotType: SlotType
  ): boolean {
    const key = generateSlotKey(nodeId, slotIndex, slotType)
    return slotErrorState.get(key) ?? false
  }

  /**
   * Clear all error states for a specific node
   * @param nodeId - The node identifier (string or number from LiteGraph)
   */
  function clearNodeErrors(nodeId: NodeId) {
    const nodeIdStr = String(nodeId)
    const nodeSlots = nodeToSlotsIndex.get(nodeIdStr)

    if (!nodeSlots) return

    for (const key of nodeSlots) {
      slotErrorState.delete(key)
    }
    nodeToSlotsIndex.delete(nodeIdStr)
  }

  /**
   * Clear all error states
   */
  function clearAllErrors() {
    slotErrorState.clear()
    nodeToSlotsIndex.clear()
  }

  return {
    setSlotError,
    hasSlotError,
    clearNodeErrors,
    clearAllErrors,
    // Expose readonly version for reactive consumption
    slotErrorState: readonly(slotErrorState)
  }
}
