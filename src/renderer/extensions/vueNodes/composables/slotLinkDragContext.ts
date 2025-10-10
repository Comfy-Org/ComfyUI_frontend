import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { SlotIdentity, SlotLayout } from '@/renderer/core/layout/types'

/**
 * Slot link drag context
 *
 * Non-reactive, per-drag ephemeral caches and RAF batching used during
 * link drag interactions. Keeps high-churn data out of the reactive UI state.
 */

interface PendingPointerMoveData {
  clientX: number
  clientY: number
  target: EventTarget | null
}

export interface SlotLinkDragContext {
  preferredSlotForNode: Map<
    NodeId,
    {
      index: number
      identity: SlotIdentity
      layout: SlotLayout
    } | null
  >
  lastHoverSlotIdentity: SlotIdentity | null
  lastHoverNodeId: NodeId | null
  lastCandidateIdentity: SlotIdentity | null
  pendingPointerMove: PendingPointerMoveData | null
  lastPointerEventTarget: EventTarget | null
  lastPointerTargetSlotIdentity: SlotIdentity | null
  lastPointerTargetNodeId: NodeId | null
  reset: () => void
  dispose: () => void
}

export function createSlotLinkDragContext(): SlotLinkDragContext {
  const state: SlotLinkDragContext = {
    preferredSlotForNode: new Map(),
    lastHoverSlotIdentity: null,
    lastHoverNodeId: null,
    lastCandidateIdentity: null,
    pendingPointerMove: null,
    lastPointerEventTarget: null,
    lastPointerTargetSlotIdentity: null,
    lastPointerTargetNodeId: null,
    reset: () => {
      state.preferredSlotForNode = new Map()
      state.lastHoverSlotIdentity = null
      state.lastHoverNodeId = null
      state.lastCandidateIdentity = null
      state.pendingPointerMove = null
      state.lastPointerEventTarget = null
      state.lastPointerTargetSlotIdentity = null
      state.lastPointerTargetNodeId = null
    },
    dispose: () => {
      state.reset()
    }
  }

  return state
}
