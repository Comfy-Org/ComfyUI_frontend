import { reactive, readonly } from 'vue'

import type { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point, SlotLayout } from '@/renderer/core/layout/types'

type SlotDragType = 'input' | 'output'

interface SlotDragSource {
  nodeId: string
  slotIndex: number
  type: SlotDragType
  direction: LinkDirection
  position: Readonly<Point>
  linkId?: number
  movingExistingOutput?: boolean
}

export interface SlotDropCandidate {
  layout: SlotLayout
  compatible: boolean
}

interface PointerPosition {
  client: Point
  canvas: Point
}

interface SlotDragState {
  active: boolean
  pointerId: number | null
  source: SlotDragSource | null
  pointer: PointerPosition
  candidate: SlotDropCandidate | null
}

const state = reactive<SlotDragState>({
  active: false,
  pointerId: null,
  source: null,
  pointer: {
    client: { x: 0, y: 0 },
    canvas: { x: 0, y: 0 }
  },
  candidate: null
})

function updatePointerPosition(
  clientX: number,
  clientY: number,
  canvasX: number,
  canvasY: number
) {
  state.pointer.client.x = clientX
  state.pointer.client.y = clientY
  state.pointer.canvas.x = canvasX
  state.pointer.canvas.y = canvasY
}

function setCandidate(candidate: SlotDropCandidate | null) {
  state.candidate = candidate
}

function beginDrag(source: SlotDragSource, pointerId: number) {
  state.active = true
  state.source = source
  state.pointerId = pointerId
  state.candidate = null
}

function endDrag() {
  state.active = false
  state.pointerId = null
  state.source = null
  state.pointer.client.x = 0
  state.pointer.client.y = 0
  state.pointer.canvas.x = 0
  state.pointer.canvas.y = 0
  state.candidate = null
}

function getSlotLayout(nodeId: string, slotIndex: number, isInput: boolean) {
  const slotKey = getSlotKey(nodeId, slotIndex, isInput)
  return layoutStore.getSlotLayout(slotKey)
}

export function useSlotLinkDragState() {
  return {
    state: readonly(state),
    beginDrag,
    endDrag,
    updatePointerPosition,
    setCandidate,
    getSlotLayout
  }
}
