/**
 * Slot Registration
 *
 * Handles registration of slot layouts with the layout store for hit testing.
 * This module manages the state mutation side of slot layout management,
 * while pure calculations are handled separately in SlotCalculations.ts.
 */
import type { Point } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  calculateInputSlotPos,
  calculateOutputSlotPos
} from '@/renderer/core/canvas/litegraph/slotCalculations'
import type { SlotPositionContext } from '@/renderer/core/canvas/litegraph/slotCalculations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'

import { getSlotKey } from './slotIdentifier'

/**
 * Register slot layout with the layout store for hit testing
 * @param nodeId The node ID
 * @param slotIndex The slot index
 * @param isInput Whether this is an input slot
 * @param position The slot position in graph coordinates
 */
function registerSlotLayout(
  nodeId: string,
  slotIndex: number,
  isInput: boolean,
  position: Point
): void {
  const slotKey = getSlotKey(nodeId, slotIndex, isInput)

  // Calculate bounds for the slot using LiteGraph's standard slot height
  const slotSize = LiteGraph.NODE_SLOT_HEIGHT
  const halfSize = slotSize / 2

  const slotLayout: SlotLayout = {
    nodeId,
    index: slotIndex,
    type: isInput ? 'input' : 'output',
    position: { x: position[0], y: position[1] },
    bounds: {
      x: position[0] - halfSize,
      y: position[1] - halfSize,
      width: slotSize,
      height: slotSize
    }
  }

  layoutStore.updateSlotLayout(slotKey, slotLayout)
}

/**
 * Register all slots for a node
 * @param nodeId The node ID
 * @param context The slot position context
 */
export function registerNodeSlots(
  nodeId: string,
  context: SlotPositionContext
): void {
  // Register input slots
  context.inputs.forEach((_, index) => {
    const position = calculateInputSlotPos(context, index)
    registerSlotLayout(nodeId, index, true, position)
  })

  // Register output slots
  context.outputs.forEach((_, index) => {
    const position = calculateOutputSlotPos(context, index)
    registerSlotLayout(nodeId, index, false, position)
  })
}
