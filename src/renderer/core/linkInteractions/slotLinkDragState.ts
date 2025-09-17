import { reactive, readonly, shallowReactive } from 'vue'

import type { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'

type SlotDragType = 'input' | 'output'

export interface SlotDragSource {
  nodeId: string
  slotIndex: number
  type: SlotDragType
  direction: LinkDirection
  position: Readonly<{ x: number; y: number }>
}

export interface SlotDropCandidate {
  layout: SlotLayout
  compatible: boolean
}

interface PointerPosition {
  client: Readonly<{ x: number; y: number }>
  canvas: Readonly<{ x: number; y: number }>
}

interface SlotDragState {
  active: boolean
  pointerId: number | null
  source: SlotDragSource | null
  pointer: PointerPosition
  candidate: SlotDropCandidate | null
}

const defaultPointer: PointerPosition = Object.freeze({
  client: { x: 0, y: 0 },
  canvas: { x: 0, y: 0 }
})

const state = reactive<SlotDragState>({
  active: false,
  pointerId: null,
  source: null,
  pointer: defaultPointer,
  candidate: null
})

function updatePointerPosition(position: PointerPosition) {
  state.pointer = shallowReactive({
    client: position.client,
    canvas: position.canvas
  })
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
  state.pointer = defaultPointer
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
