import type { SlotLayout } from '@/renderer/core/layout/types'

interface PendingMoveData {
  clientX: number
  clientY: number
  target: EventTarget | null
}

interface SlotLinkDragSession {
  compatCache: Map<string, boolean>
  nodePreferred: Map<
    number,
    { index: number; key: string; layout: SlotLayout } | null
  >
  lastHoverSlotKey: string | null
  lastHoverNodeId: number | null
  lastCandidateKey: string | null
  pendingMove: PendingMoveData | null
  reset: () => void
  dispose: () => void
}

export function createSlotLinkDragSession(): SlotLinkDragSession {
  const state: SlotLinkDragSession = {
    compatCache: new Map(),
    nodePreferred: new Map(),
    lastHoverSlotKey: null,
    lastHoverNodeId: null,
    lastCandidateKey: null,
    pendingMove: null,
    reset: () => {
      state.compatCache = new Map()
      state.nodePreferred = new Map()
      state.lastHoverSlotKey = null
      state.lastHoverNodeId = null
      state.lastCandidateKey = null
      state.pendingMove = null
    },
    dispose: () => {
      state.reset()
    }
  }

  return state
}
